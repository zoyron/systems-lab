# Systems-lab

A personal learning laboratory for becoming a **TypeScript engineer who can build agent-native systems**

A deliberate path of hands-on projects in **TypeScript + Node.js**, ramping from backend fundamentals through the **context-engineering** and **AI-agent infrastructure** that today's startups are actually built on: tool-calling loops, memory and summarization, MCP servers, agent orchestration, durable execution, evals, and observability.

### Goals

- Build real backend systems instinct: streaming, concurrency, I/O efficiency, backpressure, observability.
- Master context engineering: tokenization, token budgets, summarization, hierarchical memory, prompt caching.
- Become fluent in the agent stack: tool-calling loops, MCP, orchestration, durable execution, sandboxing, and evals.
- Ship agent-native capstones polished enough to be a remote-hire portfolio.

---

## Completed projects

- **CLI File Analyzer** — a robust CLI that analyzes any JSON or CSV file and outputs schema info, row count, null counts, type detection, and basic statistics.

- **Simple Hono API** — a basic REST API using Hono with GET routes serving static/mock data, with proper TypeScript and Zod validation.

- **Tokenizer / Lexer** — a tokenizer for a slice of JavaScript, built from scratch: scans source character by character into a typed token stream (punctuation, identifiers, keywords, string literals), with whitespace handling and error reporting on malformed input.

---

### Engineering baselines (practices, not deliverables)

Applied across every repo — table stakes, and their absence is what fails take-home reviews:

- **Testing** — Vitest for unit tests, Testcontainers for integration tests that spin up real Postgres/Redis. Don't mock what you can run.
- **CI/CD** — ESLint + Prettier + a pre-commit hook + GitHub Actions running lint/typecheck/test on every PR.

---

### Tech Stack (Current Phase)

- **Language/runtime:** TypeScript (strict) + Node.js
- **Web:** Hono
- **Data:** Postgres + Prisma, Redis, pgvector, SQLite
- **Queue:** BullMQ
- **AI/agents:** Anthropic SDK / Vercel AI SDK, MCP, `gpt-tokenizer`
- **Ops:** Docker, OpenTelemetry, Prometheus

### Future Plans

Later phases will revisit the performance-critical pieces (tokenizer, sandboxing, storage layer) in **Go** and **C++**, and expand into other languages. The focus stays on **practical systems thinking**, **performance**, and **real-world backend + agent engineering**.

---

**Status:** In Progress  
**Started:** April 2026

---

Feel free to explore, star, or fork if you find it useful!

Made with ❤️ for deep learning and systems mastery.
