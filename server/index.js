import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "crypto";

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

app.post("/upload", upload.single("pdf"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    res.send(req.file.filename);
});

app.listen(5000, () => console.log("Server running on http://localhost:5000"));