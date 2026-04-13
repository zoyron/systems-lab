# Systems-lab

A personal learning laboratory for mastering **systems programming, data engineering, and modern backend development**. 

This repo is my dedicated space to build strong, production-grade skills through hands-on projects — starting with TypeScript & Node.js, and eventually expanding into Go, Python, C++, and other languages.

### Goals
- Deepen my understanding of systems concepts (streaming, concurrency, I/O efficiency, pipelines, observability, etc.)

---

## Final 25 TypeScript + Node.js Projects (70% Systems + 30% Web)

### Beginner

- [ ] 1. **CLI File Analyzer**  
  Build a robust CLI tool that analyzes any JSON or CSV file and outputs schema info, row count, null counts, type detection, and basic statistics.

- [ ] 2. **Streaming File Processor**  
  Process large CSV/JSON files using Node.js Streams for cleaning and transformation without loading the entire file into memory.

- [ ] 3. **Simple Hono API**  
  Create a basic REST API using Hono with a few GET routes serving static or mock data (with proper TypeScript and Zod validation).

- [ ] 4. **File Chunker Utility**  
  Build a CLI tool that splits large files into fixed-size or line-based chunks, processes them independently, and supports recombination.

- [ ] 5. **Local Key-Value Store**  
  Implement a persistent flat-file based key-value store with get, set, delete, and a simple index.

### Intermediate

- [ ] 6. **S3 Large File Manager**  
  Create a CLI and library for uploading and downloading large files to S3 with multipart uploads and progress tracking.

- [ ] 7. **Hono File Upload API**  
  Build a Hono API that accepts single and multiple file uploads and stores them locally or on S3.

- [ ] 8. **Concurrent Downloader**  
  Download multiple large files in parallel using worker_threads with controlled concurrency and resume support.

- [ ] 9. **Streaming Log Analyzer**  
  Process large log files using Streams, detect patterns, count errors/warnings, and generate summary reports.

- [ ] 10. **Basic Job Queue System**  
  Implement a simple job orchestrator using BullMQ with retries, priorities, and logging.

### Intermediate-Advanced

- [ ] 11. **Parallel Data Processor**  
  Build a system that processes large datasets using worker_threads with dynamic load balancing.

- [ ] 12. **Kafka Sensor Data Simulator**  
  Create a producer that generates and streams fake time-series data to Kafka at configurable rates using kafkajs.

- [ ] 13. **Hono API with Pagination & Filtering**  
  Build a Hono REST API that serves paginated, sorted, and time-range filtered data from files or S3.

- [ ] 14. **Kafka Consumer with Windowed Aggregation**  
  Consume data from Kafka, perform time-windowed aggregations, and store results efficiently.

- [ ] 15. **Efficient Binary Storage Layer**  
  Implement time-series storage using zarrita.js (Zarr) with smart chunking and compression.

### Advanced

- [ ] 16. **Real-time Data Pipeline**  
  Build an end-to-end pipeline: Sensor Simulator → Kafka → Consumer → Zarr Storage → Hono Query API.

- [ ] 17. **Hono Log Ingestion Service**  
  Create a Hono API that accepts logs via HTTP POST, parses, enriches, and stores them efficiently.

- [ ] 18. **Observability Layer**  
  Add structured logging, Prometheus metrics, and basic tracing across services.

- [ ] 19. **Job Monitoring Dashboard**  
  Build a simple Hono + HTMX dashboard to monitor job queues and pipeline health in real-time.

- [ ] 20. **Rate Limiting & Authentication**  
  Add rate limiting, JWT authentication, and API keys to your Hono APIs using middleware.

### Expert / Capstone

- [ ] 21. **Full End-to-End Data Platform**  
  Combine Kafka, worker threads, S3/Zarr storage, and Hono API into a complete mini data platform.

- [ ] 22. **Advanced Hono API Features**  
  Implement caching (Redis), OpenTelemetry tracing, and graceful shutdown in your main API.

- [ ] 23. **Production-grade File Processing Service**  
  Build a robust service for large file upload, validation, processing, and status tracking via Hono API.

- [ ] 24. **End-to-End Performance Optimization**  
  Profile and optimize the entire platform (worker threads, chunk sizes, S3, Kafka, Hono routes) and document before/after results.

- [ ] 25. **Deployable Production Platform**  
  Dockerize the full system (multiple services + Redis + Kafka), add health checks, environment config, and deployment scripts.

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
