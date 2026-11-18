import "dotenv/config";
import { Worker } from "bullmq";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import {
  generateEmbeddings,
  storeEmbeddings,
  ensureIndexExists,
} from "./pinecone.js";

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

const worker = new Worker(
  "file-upload-queue",
  async (job) => {
    console.log("Job:", job.data);
    const data = JSON.parse(job.data);

    // 1. Load the PDF
    const loader = new PDFLoader(data.path);
    const docs = await loader.load();
    console.log(`📄 Loaded ${docs.length} page(s) from ${data.filePath}`);

    // 2. Split into overlapping chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });
    const chunks = await splitter.splitDocuments(docs);
    console.log(`✂️  Created ${chunks.length} chunk(s)`);

    if (chunks.length === 0) {
      console.log("⚠️  No text found in PDF, skipping.");
      return { success: true, chunksProcessed: 0 };
    }

    // 3. Generate embeddings with Pinecone's hosted model, in batches
    const embeddings = [];
    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE).map((c) => c.pageContent);
      console.log(`🧠 Embedding chunks ${i + 1}-${i + batch.length}...`);
      embeddings.push(...(await generateEmbeddings(batch, "passage")));
    }

    // 4. Make sure the index exists, then store the vectors
    await ensureIndexExists(PINECONE_INDEX_NAME);

    await storeEmbeddings(
      PINECONE_INDEX_NAME,
      chunks.map((chunk) => ({
        text: chunk.pageContent,
        metadata: {
          source: data.filePath || "unknown",
          pageNumber: chunk.metadata?.loc?.pageNumber,
          totalPages: chunk.metadata?.pdf?.totalPages,
        },
      })),
      embeddings,
    );

    console.log(`✅ Stored ${chunks.length} chunk(s) in Pinecone index "${PINECONE_INDEX_NAME}"`);
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
