# PDF RAG — Client

The Next.js frontend for [PDF RAG](../README.md). It provides a Clerk-protected UI for uploading PDFs and chatting with the documents indexed by the backend.

Built with Next.js 15 (App Router), React 19, Tailwind CSS 4, TypeScript, Clerk, and `react-markdown`.

## Prerequisites

- Node.js 18+
- The [Express backend](../server) running on `http://localhost:5000` (or a custom URL, see [Configuration](#configuration))
- A [Clerk](https://clerk.com) application with a publishable and secret key

The full stack also needs Redis, Pinecone, and an LLM endpoint, but those are configured on the server — see the [root README](../README.md#-getting-started).

## Getting Started

From the repository root:

```bash
cd client
npm install
```

Create a `.env.local` file (env files are gitignored):

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
API_BASE_URL=http://localhost:5000
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Clerk, upload a PDF, and start asking questions.

## Configuration

| Variable | Used for | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk authentication (browser) | — |
| `CLERK_SECRET_KEY` | Clerk authentication (server) | — |
| `API_BASE_URL` | Backend URL used by the upload and chat components | `http://localhost:5000` |

> **Note:** The two API calls are made from client components, and Next.js only exposes `NEXT_PUBLIC_*` variables to browser code. With the current code, a custom `API_BASE_URL` won't be available in the browser, so the fallback (`http://localhost:5000`) is used. Either keep the backend on port 5000, or rename the variable to `NEXT_PUBLIC_API_BASE_URL` in `.env.local` and in `components/file-upload.tsx` / `components/ChatComponent.tsx`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server with Turbopack |
| `npm run build` | Build for production with Turbopack |
| `npm run start` | Serve the production build |

## What's here

```
client/
├── app/
│   ├── layout.tsx          # Root layout: ClerkProvider, Header, toasts, signed-in/out views
│   ├── page.tsx            # Two-panel layout: PDF upload + chat
│   ├── globals.css         # Tailwind CSS and custom animations
│   └── favicon.ico
├── components/
│   ├── Header.tsx          # App bar with logo and Clerk UserButton
│   ├── file-upload.tsx     # PDF picker; POSTs to /upload
│   └── ChatComponent.tsx   # Chat UI; POSTs to /chat, renders Markdown answers
├── middleware.ts           # Clerk middleware
├── .env.local              # Your local keys (not committed)
├── next.config.ts
└── postcss.config.mjs         # Tailwind CSS 4 setup
```

## Behavior

- **Auth:** Visitors see Clerk's `SignUp` component; signed-in users get the app shell and a `UserButton` in the header.
- **Upload:** Selecting a PDF submits it as `multipart/form-data` to `POST {API_BASE_URL}/upload` with the field name `pdf`. The UI shows upload progress, success, or error state (client-side limit note: PDFs up to 10 MB).
- **Chat:** `POST {API_BASE_URL}/chat` sends `{ "query": "..." }` and renders `data.message` as GitHub-flavored Markdown (headings, lists, tables, code blocks). Answers are grounded in the uploaded documents by the backend's RAG pipeline.
- **UX:** Suggested prompts, typing indicator, auto-scrolling, copy-to-clipboard, "New chat" reset, Enter to send / Shift+Enter for a new line, and toast notifications for errors.

For architecture, backend setup, and API details, see the [root README](../README.md).
