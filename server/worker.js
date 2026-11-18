import { Worker } from "bullmq";
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAIEmbeddings } from "@langchain/openai";
import { CharacterTextSplitter } from "@langchain/textsplitters";

import dotenv from "dotenv";
dotenv.config({
    path: "./.env",
});

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

const worker = new Worker(
  "file-upload-queue",
  async (job) => {
    console.log("Job:", job.data);
    const data = JSON.parse(job.data)
    const loader = new PDFLoader(data.path);
    const docs = await loader.load();

    const splitter = new CharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });

    const chunks = await splitter.splitDocuments(docs);
    console.log(chunks.length, chunks);
  },
  {
    concurrency: 100,
    connection: {
      host: redisUrl.hostname,
      port: parseInt(redisUrl.port, 10) || 6379,
      username: redisUrl.username || undefined,
      password: redisUrl.password || undefined,
      tls: true, // Force TLS for Upstash
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


