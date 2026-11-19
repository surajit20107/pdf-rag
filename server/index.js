import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "crypto";
import { Queue } from "bullmq";
import { queryEmbeddings } from "./lib/pinecone.js";
import { getFinalResponse } from "./lib/chat.js";
import { readLimiter, writeLimiter } from "./lib/rateLimiters.js";
import fs from "fs";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
  standardHeaders: "draft-8", // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
  // store: ... , // Redis, Memcached, etc. See below.
});

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Parse Redis URL to get host and port
const redisUrl = new URL(process.env.REDIS_URL || "redis://localhost:6379");
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX || "pdf-docs";

const queue = new Queue("file-upload-queue", {
  connection: {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port, 10) || 6379,
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    tls: redisUrl.protocol === "rediss:",
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: true,
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    crypto.randomBytes(16, function (err, raw) {
      if (err) return cb(err);
      cb(null, raw.toString("hex") + "." + file.originalname.split(".").pop());
    });
  },
});

const upload = multer({ storage: storage });

const app = express();

app.use(express.json());
app.use(limiter);
app.use(
  cors({
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  }),
);

app.get("/health", (_, res) => {
  res.status(200).json({ message: "OK" });
});

app.post("/upload", writeLimiter, upload.single("pdf"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const job = await queue.add("file-ready", {
      filePath: req.file.originalname,
      destination: req.file.destination,
      path: req.file.path,
    });
    console.log("JOB DATA IN API ROUTE:", job);
    
    return res.status(200).json({ message: "File uploaded successfully", jobId: job.id });
  } catch (err) {
    fs.unlinkSync(req.file.path);
    return res.status(500).json({ error: err.message });
  }

});

app.post("/chat", readLimiter, async (req, res) => {
  const userQuery = req.body.query;
  // query the vector db
  const result = await queryEmbeddings(PINECONE_INDEX_NAME, userQuery);
  const aiResponse = await getFinalResponse(userQuery, result);
  const uniqueDocs = [...new Set(result.map((doc) => doc.metadata.source))];
  return res.status(200).json({ message: aiResponse, docs: uniqueDocs });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
