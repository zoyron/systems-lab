# Systems-lab

A personal learning laboratory for mastering **systems programming, data engineering, and modern backend development**.

This repo is my dedicated space to build strong, production-grade skills through hands-on projects — starting with TypeScript & Node.js, and eventually expanding into Go, Python, C++, and other languages.

### Goals

- Deepen my understanding of systems concepts (streaming, concurrency, I/O efficiency, pipelines, observability, etc.)

---

## Final 30 TypeScript + Node.js Projects (60% Systems + 25% Web + 15% Database)

### Beginner

- [x] 1. **CLI File Analyzer**  
     Build a robust CLI tool that analyzes any JSON or CSV file and outputs schema info, row count, null counts, type detection, and basic statistics.

- [x] 2. **Simple Hono API**  
     Create a basic REST API using Hono with a few GET routes serving static or mock data (with proper TypeScript and Zod validation).

- [ ] 3. **Streaming File Processor**  
     Process large CSV/JSON files using Node.js Streams for cleaning and transformation without loading the entire file into memory.

- [ ] 4. **File Chunker Utility**  
     Build a CLI tool that splits large files into fixed-size or line-based chunks, processes them independently, and supports recombination.

- [ ] 5. **Local Key-Value Store**  
     Implement a persistent flat-file based key-value store with get, set, delete, and a simple index.

- [ ] 6. **Postgres CLI with Prisma**  
     Build a CLI tool that stores and queries structured records (like employee data) in a Postgres database using Prisma. Practice schema definition, type-safe queries, and running migrations from the command line.

### Intermediate

- [ ] 7. **S3 Large File Manager**  
     Create a CLI and library for uploading and downloading large files to S3 with multipart uploads and progress tracking.

- [ ] 8. **Hono File Upload API**  
     Build a Hono API that accepts single and multiple file uploads and stores them locally or on S3.

- [ ] 9. **Concurrent Downloader**  
     Download multiple large files in parallel using worker_threads with controlled concurrency and resume support.

- [ ] 10. **Streaming Log Analyzer**  
      Process large log files using Streams, detect patterns, count errors/warnings, and generate summary reports.

- [ ] 11. **Basic Job Queue System**  
      Implement a simple job orchestrator using BullMQ with retries, priorities, and logging.

- [ ] 12. **Relational Schema & CSV Importer**  
      Design a multi-table Postgres schema with foreign keys and relations using Prisma. Build a pipeline that reads CSV/JSON files and bulk-inserts them into the relational schema, handling migrations, upserts, and constraint violations.

### Intermediate-Advanced

- [ ] 13. **Parallel Data Processor**  
      Build a system that processes large datasets using worker_threads with dynamic load balancing.

- [ ] 14. **Kafka Sensor Data Simulator**  
      Create a producer that generates and streams fake time-series data to Kafka at configurable rates using kafkajs.

- [ ] 15. **Hono API with Pagination & Filtering**  
      Build a Hono REST API that serves paginated, sorted, and time-range filtered data from files or S3.

- [ ] 16. **Kafka Consumer with Windowed Aggregation**  
      Consume data from Kafka, perform time-windowed aggregations, and store results efficiently.

- [ ] 17. **Efficient Binary Storage Layer**  
      Implement time-series storage using zarrita.js (Zarr) with smart chunking and compression.

- [ ] 18. **Database-Backed Query Service**  
      Integrate Postgres into your Hono API using Prisma with connection pooling and transactions. Move pagination and filtering logic from the file layer to the database layer with proper indexing and query planning.

### Advanced

- [ ] 19. **Real-time Data Pipeline**  
      Build an end-to-end pipeline: Sensor Simulator → Kafka → Consumer → Zarr Storage → Hono Query API.

- [ ] 20. **Hono Log Ingestion Service**  
      Create a Hono API that accepts logs via HTTP POST, parses, enriches, and stores them efficiently.

- [ ] 21. **Observability Layer**  
      Add structured logging, Prometheus metrics, and basic tracing across services.

- [ ] 22. **Job Monitoring Dashboard**  
      Build a simple Hono + HTMX dashboard to monitor job queues and pipeline health in real-time.

- [ ] 23. **Rate Limiting & Authentication**  
      Add rate limiting, JWT authentication, and API keys to your Hono APIs using middleware.

- [ ] 24. **Time-Series Storage with Postgres**  
      Add a Postgres time-series schema to the data pipeline with table partitioning by time range and BRIN indexes. Implement efficient bulk inserts from the Kafka consumer and benchmark time-range queries using EXPLAIN ANALYZE.

### Expert / Capstone

- [ ] 25. **Full End-to-End Data Platform**  
      Combine Kafka, worker threads, S3/Zarr storage, and Hono API into a complete mini data platform.

- [ ] 26. **Advanced Hono API Features**  
      Implement caching (Redis), OpenTelemetry tracing, and graceful shutdown in your main API.

- [ ] 27. **Production-grade File Processing Service**  
      Build a robust service for large file upload, validation, processing, and status tracking via Hono API.

- [ ] 28. **End-to-End Performance Optimization**  
      Profile and optimize the entire platform (worker threads, chunk sizes, S3, Kafka, Hono routes) and document before/after results.

- [ ] 29. **Deployable Production Platform**  
      Dockerize the full system (multiple services + Redis + Kafka), add health checks, environment config, and deployment scripts.

- [ ] 30. **Production Database Operations**  
      Implement zero-downtime schema migrations, configure read replicas, and profile slow queries using pg_stat_statements. Tune connection pool settings across the full platform and document before/after query performance metrics.

---

## Supplementary Projects (Gap Coverage)

These fill gaps in the main 30: testing, auth depth, queue semantics, real-time, distributed systems patterns, memory management, and a product-shaped capstone. Each item says *when* to build it relative to the main list — respect the prereqs so you're not learning three new concepts at once.

### Baselines (practices, not standalone deliverables)

- **Testing baseline** — retrofit Vitest + Testcontainers to every repo starting from Project 7 onward. Unit tests for pure logic; integration tests that spin up real Postgres/Kafka/Redis containers. Don't mock what you can run.  
     *Build after: Project 6. Retrofit to Projects 1–2 as warmup.*

- **CI/CD baseline** — every repo gets ESLint + Prettier + Husky pre-commit + GitHub Actions running lint/typecheck/test on PRs. Table stakes, not a deliverable.  
     *Build after: none — retrofit to existing repos (cli-file-analyzer, simple-hono-api) first as warmup, then apply to every new project from Project 3 onward.*

### Auth Depth

- [ ] A1. **Session + JWT + Refresh Token Auth Service** (Intermediate)  
     Hono auth service with argon2 password hashing, httpOnly session cookies, JWT access tokens, and refresh token rotation with reuse detection. Write up session vs stateless auth tradeoffs in the README.  
     *Build after: Project 6. Don't attempt before Postgres + Prisma comfort.*

- [ ] A2. **OAuth2 / OIDC Client with Google & GitHub** (Intermediate-Advanced)  
     Authorization code flow with PKCE against real providers using openid-client. Handle token refresh, revocation, and account linking.  
     *Build after: A1. Don't attempt before A1 — you need the session vs JWT mental model first.*

- [ ] A3. **RBAC + ABAC Authorization Service** (Advanced)  
     Build a policy engine (roles, permissions, resource-level rules) and wire it as Hono middleware. Full test coverage for policy evaluation.  
     *Build after: A1 and Project 12. Don't attempt without a multi-table relational schema to protect.*

### Queue & Messaging Semantics

- [ ] Q1. **Idempotent Kafka Consumer** (Intermediate-Advanced)  
     Consume from Kafka with idempotency keys persisted in Postgres to handle at-least-once delivery without duplicate side effects. Benchmark dedup overhead.  
     *Build after: Project 16. Don't attempt before Project 14 — you need Kafka producer/consumer fluency first.*

- [ ] Q2. **Transactional Outbox Pattern** (Advanced)  
     Write domain event + business row in a single Postgres transaction, relay to Kafka via a poller. Prove no lost events under crash with a chaos test.  
     *Build after: Q1 and Project 18. Don't attempt before Q1.*

- [ ] Q3. **Dead Letter Queue + Replay Tool** (Intermediate-Advanced)  
     Add DLQ to a BullMQ/Kafka consumer with configurable retry policies. Build a CLI to inspect, filter, and replay dead messages.  
     *Build after: Project 11 (for BullMQ flavor) or Project 16 (for Kafka flavor).*

### Real-time / WebSockets

- [ ] W1. **Real-time Chat with Hono + WebSockets** (Intermediate)  
     Multi-room chat with typing indicators and presence. Handle reconnection, message ordering, and backfill on reconnect.  
     *Build after: Project 8. Don't attempt before Hono middleware + file upload comfort.*

- [ ] W2. **WebSocket Pub/Sub with Redis Fan-out** (Advanced)  
     Scale WebSocket connections horizontally using Redis pub/sub across multiple Hono instances. Benchmark connection limits and fan-out latency.  
     *Build after: W1 and Project 26. Don't attempt before W1 — you need single-instance WebSocket fluency first.*

### Distributed Systems Patterns

- [ ] D1. **Resilient HTTP Client Library** (Intermediate)  
     Reusable HTTP client with exponential backoff + jitter, configurable timeouts, and a circuit breaker (opossum or hand-rolled). Use it for all outbound calls in later projects.  
     *Build after: Project 7. Good to build before Project 14 so Kafka producers can use it for schema registry calls etc.*

- [ ] D2. **Distributed Lock with Redis (Redlock)** (Advanced)  
     Coordinate cron jobs or leader election across multiple instances. Document the correctness caveats honestly — Redlock is contested in the literature.  
     *Build after: Project 26 and Project 29. Don't attempt before Project 26 — Redis fluency required, and you need a multi-instance scenario to justify it.*

### Memory Management & Buffer Control

The goal of this section is not just writing code that doesn't leak — it's developing an instinct for *where* leaks happen and *why*. In every project here, instrument your work: track `process.memoryUsage().heapUsed` before and after operations, take V8 heap snapshots and diff them, and deliberately cause the failure mode first before fixing it. Seeing the heap misbehave and then correcting it teaches more than the correct implementation alone.

- [ ] M1. **Bounded Ring Buffer** (Beginner)  
     Implement a fixed-size circular buffer from scratch — no libraries. When full, new writes overwrite the oldest entry. Track head/tail pointers manually and expose `read`, `write`, `isFull`, and `isEmpty` methods with full test coverage. The point is not the data structure itself but forcing you to reason about fixed memory slots and what "capacity" really means at a low level.  
     *Build after: Project 3. Don't attempt before streams — you need the mental model of bounded data flow first.*

- [ ] M2. **Streaming Token Accumulator** (Beginner-Intermediate)  
     Hit a real streaming LLM API (Anthropic or OpenAI) and accumulate response chunks into a buffer. Track heap usage in real time using `process.memoryUsage()`. First, deliberately do it wrong — never evict, let the buffer grow unbounded, and observe the heap climb. Then fix it with a configurable size cap that drops oldest chunks when exceeded. Document the before/after heap graphs in the README.  
     *Build after: M1 and Project 3. You need ring buffer intuition and stream familiarity before this.*

- [ ] M3. **Backpressure-aware Transform Pipeline** (Intermediate)  
     Build a fast producer (tight loop generating random data) piped into a slow consumer (artificial write delay simulating a TUI renderer or disk). Without backpressure, the buffer between them explodes. Implement correct `pause()`/`resume()` handling — or a proper Node.js Transform stream — so the producer slows to match the consumer. Measure peak memory with and without backpressure. This is the exact same problem as a fast LLM stream feeding a slow terminal renderer.  
     *Build after: M2 and Project 10. Don't attempt before you're comfortable with Node.js Streams internals.*

- [ ] M4. **Sliding Window Context Manager** (Intermediate)  
     Build a class that holds a conversation history but enforces a strict token budget. When the budget is exceeded, it evicts the oldest messages first — but always preserves the system prompt. Expose methods for `add`, `evict`, `totalTokens`, and `snapshot`. Write property-based tests that prove the budget is never exceeded regardless of message sequence. This is the core of what every AI coding agent does with its context window.  
     *Build after: M2. Don't attempt before you've dealt with unbounded accumulation in M2 — the eviction logic only makes sense once you've felt the problem.*

- [ ] M5. **Unbounded Process Output Handler** (Intermediate)  
     Spawn a child process that produces a large or infinite stream of output (`find /`, a log tail, or a synthetic generator). Read its stdout without buffering the whole thing — process line by line, apply a filter, and drop what you don't need. Then deliberately do it wrong first: buffer everything into an array and watch memory spike. The contrast is the lesson. Add a configurable max-lines cap that signals the child process to stop via `SIGTERM` when exceeded.  
     *Build after: M3 and Project 9. You need child process and stream fluency before this.*

- [ ] M6. **Session Memory Manager with Disk Spillover** (Intermediate-Advanced)  
     Build a multi-session store where each session has a configurable memory budget. When a session goes idle (no activity for N seconds) or the total store exceeds its budget, serialize the session to disk (SQLite or flat JSON) and free the in-memory buffer. When accessed again, deserialize from disk transparently. Benchmark the serialize/deserialize round-trip latency and document the tradeoff between memory savings and access cost. This is almost exactly what opencode does with SQLite for session persistence.  
     *Build after: M4, M5, and Project 5. Don't attempt before M4 — you need the context manager mental model first.*

- [ ] M7. **Heap Snapshot Diff Tool** (Advanced)  
     Build a CLI tool that takes two V8 heap snapshots (using the `v8` module or `--inspect` protocol) of a running process, diffs them, and reports which object types grew, by how much, and which allocation sites are responsible. Run it against a deliberately leaky version of M2 or M5 to confirm it catches the leak. This is a tooling project — the output is the diagnostic capability, not a feature. Real-world memory debugging almost always requires a tool like this.  
     *Build after: M5 and Project 21 (Observability Layer). You need observability intuition before building observability tooling.*

### Product-Shaped Capstone

- [ ] P1. **Multi-user Team Task App** (Intermediate-Advanced)  
     End-to-end product: auth (A1), RBAC (A3), real-time updates (W1), file attachments (S3), background jobs (BullMQ), full tests, simple HTMX or React frontend. Your "hiring manager" demo — one polished product, not plumbing.  
     *Build after: A1, A3, W1, Project 7, Project 11. Budget 1–2 weeks, not a weekend — this is an integrative capstone.*

---

### Future Plans

This repository will eventually include implementations in:

- Go
- Python
- C++
- And other languages as I progress

The focus will remain on **practical systems thinking**, **performance**, and **real-world backend engineering**.

### Tech Stack (Current Phase)

- TypeScript + Node.js
- Hono and Express

---

**Status:** In Progress  
**Started:** April 2026

---

Feel free to explore, star, or fork if you find it useful!

Made with ❤️ for deep learning and systems mastery.
