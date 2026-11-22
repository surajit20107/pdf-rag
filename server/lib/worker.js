import "dotenv/config";
import { Worker } from "bullmq";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import crypto from "crypto";
import {
  generateEmbeddings,
  upsertVectors,
  sanitizeMetadata,
  ensureIndexExistsCached,
} from "./pinecone.js";
import fs from "fs";

// Parse Redis URL to get host and port
// Note: Use full-permissions user (not _ro) for BullMQ
const redisUrlStr = process.env.REDIS_URL?.replace("default_ro", "default") || "redis://localhost:6379";
const redisUrl = new URL(redisUrlStr);

console.log("🔍 Redis config:", {
  host: redisUrl.hostname,
  port: redisUrl.port,
  username: redisUrl.username,
  protocol: redisUrl.protocol,
  hasPassword: !!redisUrl.password,
});

const PINECONE_INDEX_NAME =
  process.env.PINECONE_INDEX_NAME || process.env.PINECONE_INDEX || "pdf-docs";
const EMBED_BATCH_SIZE = 96; // Pinecone inference limit per request
// How many embed/upsert round-trips to have in flight at once. Higher is faster
// but more likely to hit Pinecone rate limits; tune per plan.
const BATCH_CONCURRENCY = Number(process.env.INGEST_CONCURRENCY) || 4;
// Large documents raise concurrency up to this ceiling so a single big PDF can
// use the bandwidth that small uploads don't need. Rate-limited requests are
// retried, so overshooting degrades to slower rather than failing.
const MAX_BATCH_CONCURRENCY = Math.max(
  Number(process.env.INGEST_MAX_CONCURRENCY) || 10,
  BATCH_CONCURRENCY,
);
// Bigger chunks mean fewer embedding requests for the same document, which is
// the cheapest way to make large PDFs faster. 1000/150 keeps retrieval quality
// close to 500/50 while roughly halving the number of vectors.
const CHUNK_SIZE = Number(process.env.CHUNK_SIZE) || 1000;
const CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP) || 150;
const MAX_ATTEMPTS = 4;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(err) {
  const status = err?.status ?? err?.response?.status ?? err?.statusCode;
  if (typeof status !== "number") return false;
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

async function withRetry(fn, label) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !isRetryable(err)) throw err;
      const delay = 500 * 2 ** (attempt - 1);
      console.warn(`⚠️  ${label} failed on attempt ${attempt} (${err.message}), retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
}

// Run fn over items with at most `limit` calls in flight, preserving result order.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

function buildRecord(chunk, values, source) {
  return {
    id: crypto.randomUUID(),
    values,
    metadata: sanitizeMetadata({
      source: source || "unknown",
      pageNumber: chunk.metadata?.loc?.pageNumber,
      totalPages: chunk.metadata?.pdf?.totalPages,
      text: chunk.pageContent,
    }),
  };
}

const worker = new Worker(
  "file-upload-queue",
  async (job) => {
    console.log("Job:", job.data);
    const data = job.data;
    const startedAt = Date.now();
    const elapsed = (since) => `${Date.now() - since}ms`;

    await job.updateProgress({ stage: "parsing", percent: 0 });

    // 1. Load the PDF
    const parseStart = Date.now();
    const loader = new PDFLoader(data.path);
    const docs = await loader.load();
    console.log(`📄 Loaded ${docs.length} page(s) from ${data.filePath} in ${elapsed(parseStart)}`);

    // 2. Split into overlapping chunks
    const splitStart = Date.now();
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    });
    const chunks = await splitter.splitDocuments(docs);
    console.log(
      `✂️  Created ${chunks.length} chunk(s) in ${elapsed(splitStart)} (chunkSize ${CHUNK_SIZE}, overlap ${CHUNK_OVERLAP})`,
    );

    if (chunks.length === 0) {
      console.log("⚠️  No text found in PDF, skipping.");
      await job.updateProgress({ stage: "done", percent: 100, processed: 0, total: 0 });
      return { success: true, chunksProcessed: 0 };
    }

    // 3 + 4. Embed and upsert in batches, pipelined so a batch is stored as soon
    // as its embeddings come back (and so the document becomes partially queryable
    // instead of waiting for all embeddings).
    const ingestStart = Date.now();
    await ensureIndexExistsCached(PINECONE_INDEX_NAME);

    const batches = [];
    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      batches.push(chunks.slice(i, i + EMBED_BATCH_SIZE));
    }

    // Scale concurrency with document size: a small upload keeps the gentle
    // default, a large one fans out further to use the spare throughput.
    const batchConcurrency = Math.min(
      MAX_BATCH_CONCURRENCY,
      Math.max(BATCH_CONCURRENCY, Math.ceil(batches.length / 4)),
    );
    console.log(`🚀 ${batches.length} batch(es) at concurrency ${batchConcurrency}`);

    let processed = 0;

    await mapWithConcurrency(batches, batchConcurrency, async (batch, batchIndex) => {
      const label = `batch ${batchIndex + 1}/${batches.length}`;

      // Chunks within a batch keep their order, so embeddings line up by index.
      const embeddings = await withRetry(
        () => generateEmbeddings(batch.map((chunk) => chunk.pageContent), "passage"),
        `embed ${label}`,
      );

      const records = batch.map((chunk, i) => buildRecord(chunk, embeddings[i], data.filePath));
      await withRetry(() => upsertVectors(PINECONE_INDEX_NAME, records), `upsert ${label}`);

      processed += batch.length;
      const percent = Math.round((processed / chunks.length) * 100);
      await job.updateProgress({
        stage: "ingesting",
        processed,
        total: chunks.length,
        percent,
      });
      console.log(`🧠 ${processed}/${chunks.length} chunk(s) stored (${percent}%)`);
    });

    console.log(
      `✅ Stored ${chunks.length} chunk(s) in Pinecone index "${PINECONE_INDEX_NAME}" in ${elapsed(ingestStart)}`,
    );

    fs.unlinkSync(data.path); // remove the uploaded file

    await job.updateProgress({
      stage: "done",
      processed: chunks.length,
      total: chunks.length,
      percent: 100,
    });
    console.log(`⏱️  Total ingest time: ${elapsed(startedAt)}`);

    return { success: true, chunksProcessed: chunks.length };
  },
  {
    concurrency: 5,
    connection: {
      host: redisUrl.hostname,
      port: parseInt(redisUrl.port, 10) || 6379,
      username: redisUrl.username || undefined,
      password: redisUrl.password || undefined,
      tls: redisUrl.protocol === "rediss:",
    },
  },
);

// Event listeners for debugging
worker.on("ready", () => {
  console.log("✅ Worker ready and listening");
});

worker.on("error", (err) => {
  console.error("❌ Worker error:", err.message);
});

worker.on("completed", (job) => {
  console.log("✅ Job completed:", job.id);
});

worker.on("failed", (job, err) => {
  console.error("❌ Job failed:", err.message);
});

worker.on("active", (job) => {
  console.log("📥 Job active:", job.id, "Data:", job.data);
});
