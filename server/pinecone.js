import { Pinecone } from "@pinecone-database/pinecone";
import crypto from "crypto";

import dotenv from "dotenv";
dotenv.config({
  path: "./.env",
});

const pineconeClient = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Pinecone hosted embedding model. Output dimension is 1024.
export const EMBEDDING_MODEL = "llama-text-embed-v2";
export const EMBEDDING_DIMENSION = 1024;

/**
 * Generate embeddings with Pinecone's hosted inference API.
 * @param {string[]} texts
 * @param {"passage"|"query"} inputType - "passage" for documents, "query" for search queries.
 */
export async function generateEmbeddings(texts, inputType = "passage") {
  if (!texts || texts.length === 0) return [];

  const response = await pineconeClient.inference.embed({
    model: EMBEDDING_MODEL,
    inputs: texts,
    parameters: {
      input_type: inputType,
      truncate: "END",
    },
  });

  return response.data.map((item) => item.values);
}

async function waitForIndexReady(indexName, timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const description = await pineconeClient.describeIndex(indexName);
    if (description.status?.ready) return;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Index "${indexName}" did not become ready within ${timeoutMs}ms`);
}

export async function ensureIndexExists(indexName, dimension = EMBEDDING_DIMENSION) {
  const { indexes = [] } = await pineconeClient.listIndexes();
  const exists = indexes.some((index) => index.name === indexName);

  if (!exists) {
    console.log(`Creating Pinecone index "${indexName}"...`);
    await pineconeClient.createIndex({
      name: indexName,
      dimension,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: process.env.PINECONE_CLOUD || "aws",
          region: process.env.PINECONE_REGION || "us-east-1",
        },
      },
    });
    console.log(`✅ Index "${indexName}" created`);
  }

  await waitForIndexReady(indexName);
}

// Pinecone metadata only accepts strings, numbers, booleans, or string arrays.
function sanitizeMetadata(metadata = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      clean[key] = value;
    } else if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Upsert chunks and their embeddings into Pinecone.
 * @param {string} indexName
 * @param {Array<{ text: string, metadata?: object }>} chunks
 * @param {number[][]} embeddings - one vector per chunk, in the same order
 * @param {{ namespace?: string, batchSize?: number }} options
 */
export async function storeEmbeddings(indexName, chunks, embeddings, options = {}) {
  if (chunks.length !== embeddings.length) {
    throw new Error(`Mismatch: ${chunks.length} chunks but ${embeddings.length} embeddings`);
  }

  const { namespace, batchSize = 96 } = options;
  const index = namespace
    ? pineconeClient.Index(indexName).namespace(namespace)
    : pineconeClient.Index(indexName);

  const records = chunks.map((chunk, i) => ({
    id: crypto.randomUUID(),
    values: embeddings[i],
    metadata: sanitizeMetadata({
      ...chunk.metadata,
      text: chunk.text,
    }),
  }));

  for (let i = 0; i < records.length; i += batchSize) {
    await index.upsert({ records: records.slice(i, i + batchSize) });
  }

  console.log(`✅ Stored ${records.length} vectors in index "${indexName}"`);
  return records.length;
}

/**
 * Query the index with a text query.
 */
export async function queryEmbeddings(indexName, queryText, topK = 5, options = {}) {
  const [vector] = await generateEmbeddings([queryText], "query");
  const index = options.namespace
    ? pineconeClient.Index(indexName).namespace(options.namespace)
    : pineconeClient.Index(indexName);

  const response = await index.query({
    vector,
    topK,
    includeMetadata: true,
    filter: options.filter,
  });

  return response.matches.map((match) => ({
    id: match.id,
    score: match.score,
    text: match.metadata?.text || "",
    metadata: match.metadata || {},
  }));
}

export default pineconeClient;
