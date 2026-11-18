import { Worker } from "bullmq";

import dotenv from "dotenv";
dotenv.config({
    path: "./.env",
});

// Parse Redis URL to get host and port
// Note: Use full-permissions user (not _ro) for BullMQ
const redisUrlStr = process.env.REDIS_URL?.replace("default_ro", "default") || "redis://localhost:6379";
const redisUrl = new URL(redisUrlStr);

const worker = new Worker(
  "file-upload-queue",
  async (job) => {
    console.log("Job:", job);
  },
  {
    concurrency: 100,
    connection: {
      host: redisUrl.hostname,
      port: parseInt(redisUrl.port, 10) || 6379,
      username: redisUrl.username || undefined,
      password: redisUrl.password || undefined,
      tls: redisUrl.protocol === "rediss:",
    },
  },
);
