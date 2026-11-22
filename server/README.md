# PDF RAG — Server

The Express backend for [PDF RAG](../README.md). It accepts PDF uploads, processes them asynchronously into a Pinecone vector index, and answers questions by retrieving relevant chunks and calling an LLM. The companion frontend lives in [`../client`](../client/README.md).

Built with Express 4, Multer, BullMQ + Redis, Pinecone (hosted embeddings), LangChain PDF loaders/splitters, and the OpenAI SDK. ESM (`"type": "module"`).

## Prerequisites

- Node.js 18+
- A Redis instance (local or hosted, e.g. Upstash) with **read/write** credentials — BullMQ cannot use a read-only user
- A Pinecone API key (the index is created automatically if missing)
- An API key for the OpenAI-compatible LLM endpoint configured in `lib/chat.js`

## Getting Started

From the repository root:

```bash
cd server
npm install
```

Create a `.env` file (gitignored):

```env
# API
PORT=5000
CLIENT_URL=http://localhost:3000

# Redis (use rediss:// for TLS; credentials can be embedded in the URL)
REDIS_URL=redis://localhost:6379

# Pinecone
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=pdf-docs
# Optional, only used when the index has to be created:
# PINECONE_CLOUD=aws
# PINECONE_REGION=us-east-1

# LLM
OPENAI_API_KEY=your_openai_compatible_api_key
```

Start the API and the worker in separate terminals:

```bash
# Terminal 1 — HTTP API (http://localhost:5000)
npm run dev

# Terminal 2 — PDF ingestion worker
node --watch lib/worker.js
```

Then start the [client](../client/README.md) with `npm run dev` and open http://localhost:3000. `GET http://localhost:5000/health` should return `{ "message": "OK" }`.

## Configuration

| Variable | Used for | Default |
| --- | --- | --- |
| `PORT` | HTTP port for the API | `5000` |
| `CLIENT_URL` | Allowed CORS origin | `http://localhost:3000` |
| `REDIS_URL` | Redis connection for the BullMQ queue and worker | `redis://localhost:6379` |
| `PINECONE_API_KEY` | Pinecone client and hosted inference (required) | — |
| `PINECONE_INDEX` | Index used by the API | `pdf-docs` |
| `PINECONE_INDEX_NAME` | Optional override used by the worker | falls back to `PINECONE_INDEX` |
| `PINECONE_CLOUD` / `PINECONE_REGION` | Serverless index creation | `aws` / `us-east-1` |
| `OPENAI_API_KEY` | LLM requests in `lib/chat.js` | — |
| `INGEST_CONCURRENCY` | Embed/upsert batches processed in parallel per job | `4` |

The LLM provider (`https://api.bluesminds.com/v1`) and model (`deepseek-v4.1-flash-uncen`) are currently hardcoded in `lib/chat.js`. The embedding model (`llama-text-embed-v2`, 1024 dimensions, cosine) is set in `lib/pinecone.js`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with `node --watch` |
| `npm run start:server` | Start the API normally |
| `npm run pc:clear` | **Destructive:** delete all vectors in the `__default__` namespace of `PINECONE_INDEX` |
| `npm run dev:worker` / `npm run start:worker` | Intended to start the worker, but currently point to a nonexistent root `worker.js`; use `node --watch lib/worker.js` / `node lib/worker.js` instead |

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check — returns `{ "message": "OK" }` |
| `POST` | `/upload` | Multipart upload (field name `pdf`) — saves the file to `uploads/` and enqueues processing |
| `GET` | `/upload/:jobId` | Ingestion status — `{ jobId, state, progress, result, error }` |
| `POST` | `/chat` | JSON `{ "query": "..." }` — retrieves context and returns `{ "message": answer, "docs": [...] }` |

`POST /upload` responds with `{ "message": "File uploaded successfully", "jobId": ... }`, or `400` when no file is provided. `POST /chat` responds with the LLM answer in `message` and the unique source filenames in `docs`.

Rate limiters exist in `lib/rateLimiters.js` (30 reads / 3 writes per minute) but are currently commented out in `index.js`.

## How ingestion works

```
Upload ─► uploads/ ─► BullMQ "file-upload-queue" ─► Worker ─► Pinecone
                                                       │
Query ───────────────────────────────────────────────► Pinecone ─► LLM ─► Answer
```

1. **Upload** — Multer stores the PDF with a random hex filename in `uploads/`; the API adds a `file-ready` job and responds immediately with its `jobId`. Jobs retry up to 3 times with exponential backoff; completed jobs are kept for an hour (failed ones for a day) so `GET /upload/:jobId` can still report their outcome.
2. **Parse & chunk** — The worker loads the PDF with LangChain's `PDFLoader`, then splits it into 500-character chunks with 50-character overlap.
3. **Embed & store** — Chunks are embedded in batches of 96 with Pinecone's hosted model (`input_type: "passage"`) and upserted with metadata (`source`, `pageNumber`, `totalPages`, `text`). Batches are pipelined (embedded, then upserted, then the next) with up to `INGEST_CONCURRENCY` in flight, so large PDFs are searchable before the whole file is done; transient `429`/`5xx` responses are retried with backoff. The index is created automatically (1024 dimensions, cosine, serverless) if it doesn't exist, and that check is cached after the first job. Each batch reports progress on the job. The local file is deleted after a successful run.
4. **Retrieve** — On `/chat`, the query is embedded (`input_type: "query"`) and the top 5 matching chunks are fetched from Pinecone.
5. **Generate** — The chunks are injected into the system prompt as JSON context, the question is sent to the LLM, and the answer plus source filenames are returned to the client.

The worker runs with concurrency 5 and logs job lifecycle events. Uploaded PDFs (`uploads/*pdf`) and `.env` files are gitignored.

## Structure

```
server/
├── index.js              # Express app, CORS, /health, /upload, /chat
├── cleaner.js            # Clears all vectors in the default namespace (npm run pc:clear)
├── lib/
│   ├── worker.js         # BullMQ worker: PDF → chunks → embeddings → Pinecone
│   ├── pinecone.js       # Index setup, embedding generation, upsert, similarity search
│   ├── chat.js           # LLM client and RAG system prompt
│   └── rateLimiters.js   # Unused read/write rate limiters
├── uploads/              # Temporary PDF storage (gitignored)
├── .env                  # Your credentials (gitignored)
└── package.json
```

For the full stack architecture and setup, see the [root README](../README.md).
