import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "crypto";
import { Queue } from "bullmq";
import { queryEmbeddings } from "./pinecone.js";
import { getFinalResponse } from "./chat.js";

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
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/")
  },
  filename: function (req, file, cb) {
    crypto.randomBytes(16, function (err, raw) {
      if (err) return cb(err)
      cb(null, raw.toString('hex') + '.' + file.originalname.split('.').pop())
    })
  }
})

const upload = multer({ storage: storage });

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (_, res) => {
  res.send("Hello from the server!");
});

app.post("/upload", upload.single("pdf"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    await queue.add("file-ready", JSON.stringify({ 
      filePath: req.file.originalname,
      destination: req.file.destination,
      path: req.file.path,
    }));

    res.status(200).json({ message: "File uploaded successfully" });
});

app.post("/chat", async (req, res) => {
  const userQuery = req.body.query;
  // query the vector db
  const result = await queryEmbeddings(PINECONE_INDEX_NAME, userQuery);
  const aiResponse = await getFinalResponse(userQuery, result);
  const uniqueDocs = [...new Set(result.map((doc) => doc.metadata.source))];
  return res.status(200).json({ message: aiResponse, docs: uniqueDocs });
});

app.listen(5000, () => console.log("Server running on http://localhost:5000"));