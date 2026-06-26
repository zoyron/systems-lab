# Systems-lab — Condensed Edition (12 projects)

A shorter, denser path: **12 substantial projects in TypeScript + Node.js**, each one absorbing several of the original 40. Same philosophy — gradual difficulty ramp, backend and AI interleaved so you never stack three hard new concepts at once, and later projects reuse the earlier ones (the resilient streaming client, the context manager, the agent loop, the observability layer).

Difficulty is marked 🟢 easy → 🟡 moderate → 🟠 hard → 🔴 capstone. The one deliberate "breather" is Project 7: a pure-backend build placed right after the hardest conceptual leap.

Numbers in `(orig: …)` show which of the original 40 each project folds in.

---

### 🟢 1. Data + LLM CLI Toolkit  *(orig: 1, 4, 3)*
A robust CLI that analyzes JSON/CSV files (schema, row counts, null counts, type detection, stats), processes large files via Node Streams with proper backpressure, **and** ends with your first raw LLM contact: a chat loop that manually maintains the `messages` array and logs a running token count (`gpt-tokenizer`).
**Why:** gentle on-ramp to solid TS CLI + streams, and you finish by *seeing* the token-growth problem you'll engineer around for the rest of the list.

### 🟢 2. Persistent Multi-Session Chat + Embedded Store  *(orig: 5, 6)*
Build a tiny persistent key-value store first (append-only log on disk + in-memory index, crash-safe reload), then use that mental model to build multi-session chat on SQLite (`better-sqlite3`): session IDs, list/switch/rename/delete, per-session system prompts, and measuring how the prompt changes token usage.
**Why:** the data model behind every chat product, plus the embedded-store intuition behind every database.

### 🟡 3. Typed REST API on Postgres  *(orig: 2, 7, 8)*
A real service: Hono + Prisma + Zod CRUD backed by Postgres, with migrations, pagination, filtering, sorting, proper indexing, and clean error handling. Push query logic into the database.
**Why:** the backend fundamentals that make you an *engineer*, not a prompt-wrapper. First pure-backend interleave.

### 🟡 4. Resilient Streaming LLM Client  *(orig: 9, 20)*
Call a real streaming LLM API, accumulating chunks through a **bounded** buffer with backpressure and cancellation (do it wrong first — unbounded — watch the heap climb, then fix it and document the before/after). Wrap it in a reusable client with exponential backoff + jitter, timeouts, and a circuit breaker.
**Why:** this is the reusable foundation every later project calls. Build it once, well.

### 🟡 5. Context & Memory Manager  *(orig: 10, 11, 12, 13)*
The context-engineering core as one reusable library: a token budget with slots (system / history / input / response) that auto-truncates **or** summarizes on overflow but always preserves the system prompt; sliding-window and LLM-summarizer strategies; and a "inject this file into context" primitive that estimates token cost and warns when too large. Property-based tests prove the budget is never exceeded.
**Why:** this *is* "context engineering" — the single most distinctive skill cluster on the list. The heart of how every coding agent manages its window.

### 🟠 6. Tool-Calling Agent Loop + File Agent  *(orig: 16, 17)*  ⭐ keystone
Build the core agent engine by hand: model → tool calls → execute → feed results back, until done or a step limit. Tools defined with Zod schemas; errors handled mid-loop; no framework. Then make it a file agent that reads/writes/searches a directory and *decides which files are relevant* to load instead of dumping everything.
**Why:** the single most important thing on the list and the engine behind every coding agent. Reuses your client (P4) and context manager (P5).

### 🟠 7. Production API Layer  *(orig: 18, 19, 14)*  ← difficulty breather
Pure backend after the keystone: argon2 hashing, httpOnly sessions, JWT access tokens, refresh-token rotation with reuse detection; Redis token-bucket rate limiting as middleware, per-key quotas, tenant isolation; and streaming file uploads to disk/S3 without buffering whole files.
**Why:** the plumbing every B2B SaaS needs day one — and a deliberate breather in concept type so you consolidate instead of overloading right after P6.

### 🟠 8. Streaming Agent Service  *(orig: 22, 21, 23)*
Serve the agent loop over HTTP with Server-Sent Events: stream tokens and intermediate steps, support mid-run cancellation, apply backpressure for slow clients. Add WebSocket multi-room messaging (presence, typing, reconnection with backfill, correct ordering) and model the session as an explicit state machine so it stays coherent over long runs.
**Why:** turns your agent into a real, live service. Reuses the agent loop (P6) and auth (P7).

### 🟠 9. RAG + Eval Harness  *(orig: 24, 26, 27)*
Chunk and embed documents into Postgres + pgvector, retrieve with citations, and apply the same retrieval to conversation memory. Then build the eval harness: force Zod-validated structured output, build a labeled golden set, score with exact-match **and** LLM-as-judge graders, and benchmark your memory strategies (window / summarize / RAG / hierarchical) for retention vs token cost.
**Why:** RAG architecture + eval design are two of the strongest hiring signals in the market. This is where you prove you can *measure* an agent, not just build one.

### 🟠 10. MCP Server + Multi-Agent Orchestrator  *(orig: 30, 31, 28)*
Build a Model Context Protocol server exposing tools, resources, and prompts; connect to it from a client and from your agent loop (P6). Then coordinate a planner + parallel worker agents (`Promise.all` + `p-limit`), with shared state, result synthesis, and partial-failure handling. Add prompt caching (native or hash-based) and benchmark the cost/latency savings.
**Why:** MCP is recent enough that a from-scratch server is a genuine differentiator — very few candidates have one. Orchestration + cost-tracking round out the "agent infra" signal.

### 🟠 11. Durable, Observable Agent Runtime  *(orig: 32, 34, 33, 29, 35)*
Make it production-grade and crash-proof: persist every agent step so a killed process resumes exactly where it left off (checkpointing + transactional outbox), proven with a chaos test. Run agent-generated code in an isolated worker with CPU/memory/wall-clock limits. Add a memory store that spills idle sessions to SQLite and rehydrates on access. Wire in structured logging, metrics, OpenTelemetry tracing, plus per-run token-and-dollar accounting and run replay.
**Why:** "you can't ship agents you can't see" — durability, sandboxing, and observability are what separate a demo from a system.

### 🔴 12. Minimal Claude Code Clone → Deployed & Optimized  *(orig: 38, 36/37, 39, 40)*  capstone
The integrative finale: a terminal coding agent from scratch — reads/writes files, runs bash, maintains a coherent session, summarizes when the window fills, checkpoints state, has a plan mode and a build mode, no frameworks. Wrap the reusable pieces into one coherent product backend (auth + multi-tenancy + jobs + orchestration + memory + evals + observability), Dockerize the full stack, add CI/CD and a one-command deploy, then profile and optimize end-to-end (latency, throughput, token cost) with documented before/after numbers.
**Why:** touches nearly every concept on the list and is the single most impressive thing you can show a hiring manager. This is your demo.

---

### Optional sidebar — BPE Tokenizer from scratch  *(orig: 25)*
Implement byte-pair encoding: train merges on a corpus, encode/decode, validate against `gpt-tokenizer`. Not required for the application-layer jobs, but it's a satisfying algorithmic build that demystifies tokens and cost. Do it if you enjoy it — skip it without guilt if you're optimizing for time-to-offer.

---

### Notes on using this version
- **The writeups are the deliverable, not just the code.** The before/after on the unbounded buffer (P4), the stateful-vs-stateless auth tradeoffs (P7), the eval benchmarks (P9), the cost numbers (P10, P12) — those are what a founder reads in 90 seconds to judge whether you understand tradeoffs. Don't skip them.
- **Highest hiring signal per hour:** P6, P9, P10, P12. If you ever need to cut further, those four plus P4 and P5 (their dependencies) are the irreducible core.
- **Add Python to exactly one project.** Rebuild P9's backend (RAG + evals) in Python/FastAPI so your "TypeScript + Python" claim is true, not aspirational.
- **Deploy P12 publicly** so a stranger can clone and run it — one running system beats three more repos.
