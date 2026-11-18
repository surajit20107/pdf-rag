📄 PDF RAG

A full-stack Retrieval-Augmented Generation (RAG) application that lets you upload PDF documents and chat with them. Ask questions in natural language and get AI-generated answers grounded in your own documents.

---

✨ Features

· 📤 PDF Upload — Drag-and-drop PDF uploads with real-time status feedback

· 🔐 Authentication — Secure sign-in/sign-up powered by Clerk

· 💬 Chat Interface — Conversational UI with markdown rendering (tables, code blocks, lists)

· 🧠 RAG Pipeline — Automatic text extraction, chunking, embedding, and vector storage

· ⚡ Background Processing — Non-blocking PDF ingestion via BullMQ + Redis job queue

· 🎯 Grounded Answers — Responses are generated from retrieved document chunks, not hallucinated

· 📋 UX Niceties — Copy-to-clipboard, "New chat" reset, typing indicator, and smooth message animations

---

🏗️ Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Client     │ ───► │   Server     │ ───► │   Pinecone   │
│  (Next.js)   │      │  (Express)   │      │  Vector DB   │
└──────────────┘      └──────┬───────┘      └──────────────┘
                             │
                      ┌──────▼───────┐
                      │  BullMQ +    │
                      │    Redis     │
                      └──────┬───────┘
                             │
                      ┌──────▼───────┐
                      │   Worker     │
                      │ (PDF → Vec)  │
                      └──────────────┘
```

Flow:

1. Upload — User uploads a PDF; the server saves it and enqueues a background job.
2. Process — The worker extracts text, splits it into overlapping chunks, generates embeddings, and stores them in Pinecone.
3. Query — User asks a question; the server retrieves the most relevant chunks from Pinecone.
4. Generate — Retrieved chunks + query are sent to the LLM, which returns a grounded answer to the client.

---

🧰 Tech Stack

Layer Technology
Frontend Next.js, React, Tailwind CSS, react-markdown, remark-gfm
Auth Clerk
Backend Express.js, Multer (file uploads)
Queue BullMQ + Redis
Vector DB Pinecone
Embeddings Pinecone hosted llama-text-embed-v2
LLM OpenAI-compatible API (deepseek-v4.1-flash-uncen)
PDF Parsing LangChain PDFLoader / pdf-parse

---

📁 Project Structure

```
pdf-rag/
├── client/                     # Next.js frontend
│   ├── app/
│   │   ├── layout.tsx          # Root layout + ClerkProvider
│   │   ├── page.tsx            # Main page (upload + chat)
│   │   └── globals.css         # Tailwind + animations
│   ├── components/
│   │   ├── Header.tsx          # Logo + Clerk UserButton
│   │   ├── file-upload.tsx     # PDF upload component
│   │   └── ChatComponent.tsx   # Chat UI
│   └── middleware.ts           # Clerk route protection
│
├── server/                     # Express backend
│   ├── index.js                # API entry point (/upload, /chat)
│   ├── worker.js               # BullMQ worker for PDF ingestion
│   ├── pinecone.js             # Vector DB operations
│   ├── chat.js                 # LLM integration
│   └── package.json
│
└── opencode.json
```

---

🚀 Getting Started

Prerequisites

· Node.js 18+
· Redis instance (local or hosted, e.g. Upstash)
· Pinecone account + API key
· Clerk account (publishable + secret keys)
· An OpenAI-compatible LLM endpoint (API key + base URL)

1. Clone the repository

```bash
git clone https://github.com/surajit20107/pdf-rag.git
cd pdf-rag
```

2. Set up the Client

```bash
cd client
npm install
```

Create client/.env.local:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

3. Set up the Server

```bash
cd ../server
npm install
```

Create server/.env:

```env
PORT=8000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Pinecone
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=pdf-rag

# LLM
OPENAI_API_KEY=your_llm_api_key
OPENAI_BASE_URL=your_llm_base_url
```

4. Run everything

In separate terminals:

```bash
# Terminal 1 — Express API
cd server && npm run dev

# Terminal 2 — Background worker
cd server && npm run dev:worker

# Terminal 3 — Next.js client
cd client && npm run dev
```

Open http://localhost:3000, sign in, upload a PDF, and start chatting.

---

🔌 API Endpoints

Method Endpoint Description
POST /upload Upload a PDF (multipart/form-data) and enqueue processing
POST /chat Send a query; returns an AI-generated answer grounded in your documents

POST /chat request body:

```json
{
  "message": "What is the main conclusion of this paper?"
}
```

---

⚙️ How It Works

1. Chunking — PDFs are split into ~500-character chunks with 50-character overlap to preserve context.
2. Embeddings — Each chunk is embedded via Pinecone's llama-text-embed-v2 model.
3. Storage — Chunks + embeddings + metadata (source file, page number) are upserted into Pinecone.
4. Retrieval — On query, the top-k most similar chunks are fetched via vector similarity search.
5. Generation — A system prompt injects the retrieved chunks as context, and the LLM answers strictly from that context.

---

🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

1. Fork the repo
2. Create a feature branch (git checkout -b feat/amazing-feature)
3. Commit your changes (git commit -m 'feat: add amazing feature')
4. Push (git push origin feat/amazing-feature)
5. Open a Pull Request

---

📝 License

[LICENSE](/LICENSE)

---

🙏 Acknowledgements

· LangChain — PDF loading & text splitting

· Pinecone — Vector database & embeddings

· Clerk — Authentication

· BullMQ — Job queue

---

<p align="center">Built with ❤️ for document-aware AI</p>
