# Systems-lab

A personal learning laboratory for becoming a **TypeScript engineer who can build agent-native backends** — the profile early-to-mid-stage startups (YC and beyond) hire for remotely.

This repo is a single, deliberate path of 40 hands-on projects, all in **TypeScript + Node.js**, that ramps from backend fundamentals through the **context-engineering** and **AI-agent infrastructure** that today's startups are actually built on: tool-calling loops, memory and summarization, MCP servers, agent orchestration, durable execution, evals, and observability.

### Goals

- Build real backend systems instinct: streaming, concurrency, I/O efficiency, backpressure, observability.
- Master context engineering: tokenization, token budgets, summarization, hierarchical memory, prompt caching.
- Become fluent in the agent stack: tool-calling loops, MCP, orchestration, durable execution, sandboxing, and evals.
- Ship agent-native capstones polished enough to be a remote-hire portfolio.

---

## 40 TypeScript Projects — Backend Fundamentals → Context Engineering → Agent Infrastructure

Difficulty ramps **gradually** — every project is a small step up from the one before it, and the backend and AI tracks are interleaved so you're never stacking three hard new concepts at once. Later projects reuse earlier ones (the resilient HTTP client, the streaming LLM client, the context manager, the observability layer) rather than starting from scratch.

### Tier 1 — Warm-up: TypeScript, Node & first LLM calls (1–6)

- [x] 1. **CLI File Analyzer**  
     Build a robust CLI tool that analyzes any JSON or CSV file and outputs schema info, row count, null counts, type detection, and basic statistics.

- [x] 2. **Simple Hono API**  
     Create a basic REST API using Hono with a few GET routes serving static or mock data (with proper TypeScript and Zod validation).

- [ ] 3. **Raw Conversation Loop + Token Meter**  
     Your first LLM contact: a CLI chatbot that manually maintains a `messages` array and sends the full history every turn — no framework, raw API calls. Log the growing payload and a running token count (`gpt-tokenizer`) so you *see* the core resource constraint you'll engineer around for the rest of this list.

- [ ] 4. **Streaming File Processor**  
     Process large CSV/JSON files using Node.js Streams for cleaning and transformation without loading the entire file into memory. Get comfortable with backpressure — the foundation for everything that streams later.

- [ ] 5. **Local Key-Value Store**  
     Implement a persistent key-value store: an append-only log on disk plus an in-memory index, with get/set/delete and crash-safe reload. The mental model behind every embedded store.

- [ ] 6. **Persistent Multi-Session Chat**  
     Extend the conversation loop to save and reload sessions from SQLite (`better-sqlite3`): session IDs, list/switch/rename/delete. Add a per-session system prompt and measure how it changes token usage. This is the literal foundation of how a chat product stores and organizes history.

### Tier 2 — Core backend + basic context management (7–14)

- [ ] 7. **Postgres CLI with Prisma**  
     Build a CLI that stores and queries structured records in Postgres using Prisma. Practice schema definition, type-safe queries, and running migrations from the command line.

- [ ] 8. **Typed REST API on Postgres**  
     Turn Project 2 into a real service: Hono + Prisma + Zod CRUD API backed by Postgres, with pagination, filtering, sorting, and clean error handling. Push query logic into the database with proper indexing.

- [ ] 9. **Streaming LLM Client**  
     Call a real streaming LLM API and accumulate chunks through a bounded buffer with backpressure and cancellation. Reuse your streams intuition from Project 4. Do it wrong first (unbounded buffer), watch the heap climb, then fix it — and document the before/after.

- [ ] 10. **Sliding Window Memory**  
      The simplest context strategy: when the conversation exceeds N tokens, drop the oldest messages. Build it as a reusable class with a configurable window and watch what gets dropped in a long chat.

- [ ] 11. **Conversation Summarizer**  
      Instead of dropping old messages, call the LLM to summarize them into a compact note and splice it back in. Compare answer quality against the sliding window from Project 10. This is what most production chat interfaces actually do.

- [ ] 12. **Context Window / Token Budget Manager**  
      A budget with slots — system prompt, history, user input, response — that auto-truncates or summarizes on overflow but always preserves the system prompt. Property-based tests prove the budget is never exceeded. This is what every coding agent does with its context.

- [ ] 13. **File Context Injector**  
      "Add this file to the conversation": read it, estimate its token cost, inject it intelligently, and warn when it's too large. This is the core primitive behind how Claude Code knows about your files.

- [ ] 14. **File Upload + Object Storage Service**  
      A Hono API that accepts single and multipart file uploads, streams them to local disk or S3, and reports progress — without buffering whole files in memory.

### Tier 3 — Agent primitives + production backend (15–24)

- [ ] 15. **Background Job Queue**  
      A job system on BullMQ with retries, priorities, scheduled/delayed jobs, and a dead-letter queue. Build a small CLI to inspect, filter, and replay failed jobs.

- [ ] 16. **Tool-Calling Agent Loop**  
      Build the core agent loop by hand: model → tool calls → execute → feed results back, until done or a step limit is hit. Define tools with Zod schemas; handle errors mid-loop. No framework — this is the engine behind every coding agent and the single most important project on this list.

- [ ] 17. **Context-Aware File Agent**  
      An agent that reads, writes, and searches files in a directory — and decides which files are *relevant* to load into context instead of dumping everything (filename + keyword heuristics). This is the core problem Claude Code solves.

- [ ] 18. **Auth Service (Sessions + JWT + Refresh)**  
      argon2 password hashing, httpOnly session cookies, JWT access tokens, and refresh-token rotation with reuse detection. Write up the stateful-vs-stateless tradeoffs in the README.

- [ ] 19. **Rate Limiting, API Keys & Multi-Tenancy**  
      Redis token-bucket rate limiting as Hono middleware, per-key quotas, and tenant isolation. The plumbing every B2B SaaS backend needs on day one.

- [ ] 20. **Resilient HTTP Client Library**  
      A reusable client with exponential backoff + jitter, configurable timeouts, and a circuit breaker. Retrofit it into your LLM client (Project 9) and reuse it for every outbound call from here on.

- [ ] 21. **Real-time Service (WebSockets)**  
      Multi-room messaging with presence, typing indicators, reconnection with backfill, and correct message ordering. The substrate for live agent output and collaborative apps.

- [ ] 22. **Streaming Agent API (SSE)**  
      Serve the agent loop over HTTP with Server-Sent Events: stream tokens and intermediate steps to the client, support mid-run cancellation, and apply backpressure when the client is slow.

- [ ] 23. **Session State Machine**  
      Model a conversation as an explicit state machine (`collecting_info`, `processing`, `awaiting_confirmation`…), where the injected context and system prompt change per state. How production chatbots stay coherent over long sessions without losing the plot.

- [ ] 24. **RAG Pipeline (+ vector conversation memory)**  
      Chunk and embed documents into Postgres + pgvector, retrieve with citations, and measure retrieval quality. Then apply the same retrieval to conversation memory — recall only the most relevant past messages instead of replaying everything.

### Tier 4 — Context-engineering depth + agent infrastructure (25–34)

- [ ] 25. **BPE Tokenizer (from scratch)**  
      Implement byte-pair encoding from scratch: train merges on a corpus, encode/decode, and validate your counts against `gpt-tokenizer`. Demystifies context windows and cost — and it's a genuinely satisfying algorithmic build.

- [ ] 26. **Eval Harness + Compression Benchmark**  
      Force structured output (Zod-validated), build a small labeled golden set, and score agent outputs with exact-match and LLM-as-judge graders. Then benchmark your memory strategies (window / summarize / RAG / hierarchical) for information retention vs token cost. Eval design is a top hiring signal.

- [ ] 27. **Hierarchical Summarization**  
      Three tiers of memory — recent (full fidelity), medium (summarized chunks), long-term (summaries of summaries) — each at a different token cost. This is how hours-long agent sessions stay coherent.

- [ ] 28. **Prompt Caching Layer**  
      Detect the repeated system-prompt prefix (it's always there) and stop recomputing it — via the model provider's native prompt caching or your own hash-based cache. Benchmark the latency and cost savings; cost-per-call is a real metric at every AI startup.

- [ ] 29. **Observability Layer**  
      Structured logging, Prometheus metrics, OpenTelemetry tracing, health checks, and graceful shutdown, wired across a service so you can actually see what's happening in production.

- [ ] 30. **MCP Server**  
      Build a Model Context Protocol server that exposes tools, resources, and prompts, and connect to it from a client and from your agent loop (Project 16). This is YC's "software for agents" RFS made concrete — a machine-readable interface other agents can use.

- [ ] 31. **Multi-Agent Orchestrator**  
      Coordinate a planner and parallel worker agents (`Promise.all` + `p-limit` for concurrency), with shared state, result synthesis, and partial-failure handling. Decompose a task, fan out, and merge reliably.

- [ ] 32. **Durable Agent Execution**  
      Persist every step of an agent run so a crashed or restarted process resumes exactly where it left off — checkpointing plus a transactional outbox so no step is lost or duplicated. Prove it with a chaos test that kills the process mid-run.

- [ ] 33. **Agent Memory Store with Disk Spillover**  
      A multi-session memory store with per-session budgets, safe under concurrent users. When a session goes idle or the store exceeds its budget, spill it to SQLite and free the heap; rehydrate transparently on next access. Benchmark the round-trip cost.

- [ ] 34. **Sandboxed Code Execution Service**  
      Run agent-generated code in an isolated worker/child process with CPU, memory, and wall-clock limits, killing runaway processes on timeout. The capability behind every "agent that writes and runs code" product.

### Tier 5 — Production agent platform + capstones (35–40)

- [ ] 35. **Agent Observability & Cost Tracing**  
      Trace agent runs end to end: a span per tool call, token-and-dollar accounting per run, full request/response capture, and run replay, with a small dashboard. Builds on Project 29. You can't ship agents you can't see.

- [ ] 36. **AI-Native Vertical Agent**  
      Pick one real B2B workflow (support triage, ops automation, compliance review) and ship an agent that does the work end-to-end — not a chatbot, a system that completes the task. The YC "AI-native services" thesis in miniature.

- [ ] 37. **Agentic SaaS Backend**  
      Integrate the pieces into one coherent product backend: auth + multi-tenancy + jobs + orchestration + memory + evals + observability, with the agent loop at the center. Package the reusable parts as an installable SDK. (Stretch: per-tenant personalization where each agent evolves its own system prompt over time.) Your "hiring manager" demo.

- [ ] 38. **Minimal Claude Code Clone**  
      A terminal coding agent, from scratch: reads/writes files, runs bash, maintains a coherent session, summarizes when the window fills, checkpoints state, and has a plan mode and a build mode. No frameworks — raw API calls. This touches nearly every concept on the list and is the most impressive single thing you can show.

- [ ] 39. **Deployable Production Platform**  
      Dockerize the full stack (services + Postgres + Redis), add CI/CD, environment config, health checks, and a one-command deploy. Make it something a stranger can clone and run.

- [ ] 40. **End-to-End Performance & Cost Optimization**  
      Profile and optimize the platform across latency, throughput, and token cost — caching, batching, prompt/context trimming, connection pooling. Document before/after numbers. Cost-per-task is a real business metric at every AI startup.

---

### Engineering baselines (practices, not deliverables)

Apply these across every repo — they're table stakes, and their absence is what fails take-home reviews:

- **Testing** — Vitest for unit tests, Testcontainers for integration tests that spin up real Postgres/Redis. Start from Project 7 onward; don't mock what you can run.
- **CI/CD** — ESLint + Prettier + a pre-commit hook + GitHub Actions running lint/typecheck/test on every PR. Retrofit to the existing repos first, then apply to every new project.

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
