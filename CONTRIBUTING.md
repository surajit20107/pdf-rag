# Contributing to PDF RAG

Thanks for your interest in improving PDF RAG! This guide covers how to report issues, propose changes, and get a pull request merged.

## Ground rules

- Be respectful and constructive in issues, pull requests, and reviews.
- Search existing issues before opening a new one.
- Keep changes focused — one concern per pull request.
- Never commit secrets, API keys, `.env` files, or uploaded PDFs. Both `.env*` and `uploads/*pdf` are gitignored; keep it that way.

## Reporting a bug

Open an [issue](https://github.com/surajit20107/pdf-rag/issues/new) with:

- A clear title and description of the problem
- Steps to reproduce, what you expected, and what happened instead
- Which part is affected: **client**, **server**, or **docs**
- Your OS, Node.js version, and browser (if relevant)
- Relevant logs or screenshots, with credentials and keys redacted

## Suggesting an enhancement

Open an issue describing the use case, the proposed solution, and any alternatives you considered. For larger changes, open an issue first so the approach can be discussed before you invest time in code.

## Development setup

1. Fork the repository and clone your fork.
2. Follow the setup in the [root README](README.md#-getting-started), plus the [client](client/README.md) and [server](server/README.md) READMEs for package-level details.
3. Create a branch from `main`:

   ```bash
   git checkout -b feat/short-description
   ```

   Use prefixes such as `feat/`, `fix/`, `docs/`, `refactor/`, or `chore/`.

4. Make your changes, then verify them locally.

## Before opening a pull request

There is no automated test suite for the application yet, so please verify manually:

- **Client:** `cd client && npm run build` succeeds, and `npm run dev` renders the sign-in/up screen and chat UI correctly.
- **Server:** `cd server && npm run dev` starts cleanly and `GET /health` returns `{ "message": "OK" }`.
- **End-to-end:** with Redis, Pinecone, and the LLM key configured, upload a PDF, wait for the worker to finish indexing, and confirm `/chat` returns a grounded answer.
- Check that no `.env` files, credentials, `node_modules`, build output, or uploaded PDFs are staged (`git status`).

## Commit and PR guidelines

- Use [Conventional Commits](https://www.conventionalcommits.org/) where practical, e.g. `feat: add source citations to chat answers`, `fix: handle empty PDF text`, `docs: add server README`.
- Keep commits small and self-explanatory; avoid "WIP" commits in the final PR.
- In your PR description, include: what changed, why, how you verified it, and any related issue (e.g. `Closes #12`).
- Update the relevant README if you change setup steps, environment variables, scripts, or API behavior.
- Expect review feedback — please respond to comments and keep the branch up to date with `main`.

## Code style

- **Client:** TypeScript, Next.js App Router, Tailwind CSS utility classes. Match the existing component structure and naming.
- **Server:** ESM JavaScript (`"type": "module"`), Express 4. Keep queue, vector-store, and LLM logic in `lib/`.
- Add short comments only where the reasoning isn't obvious from the code.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
