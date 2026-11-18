import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "crypto";
import { Queue } from 'bullmq';

const queue = new Queue("file-upload-queue");

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
});

app.listen(5000, () => console.log("Server running on http://localhost:5000"));