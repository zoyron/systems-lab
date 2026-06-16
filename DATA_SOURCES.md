# Data Sources

Where to source data and model access for the projects in this repo, organized by what each project actually needs. Project numbers refer to the 40-project list in `README.md`.

## Large files — CSV / JSON / blobs (Projects 1, 4, 5, 14)

File analysis, streaming transforms, append-log KV stores, and upload/object-storage.

- **NYC Taxi Trip Records** (nyc.gov/site/tlc/about/tlc-trip-record-data) — monthly files run 2–5 GB, perfect for forcing actual streaming in #4. The classic pick.
- **GitHub Archive** (gharchive.org) — newline-delimited JSON of public GitHub events, ~1–2 GB/day. Great for #1 and #4.
- **Wikipedia dumps / Linux ISOs / public video** — anything big for upload + object storage (#14). Don't overthink it.
- **Common Crawl** — if you want to push streaming (#4) to insane scale later.

## Relational data (Projects 7, 8)

Multi-table Postgres + Prisma.

- **Kaggle** — messy real-world multi-table sets (e-commerce, movies, Olympics — tons of candidates).
- **Sakila** / **Chinook** — pre-built sample schemas if you just want to practice queries fast.
- **Faker.js** — when you only need the shape, not realism.

## Synthetic / pattern data (Projects 5, 6, 15, 18, 19, 21)

KV store, chat sessions, job queue, auth users, tenants, chat messages — realism doesn't matter here, read/write *patterns* do.

- **Faker.js** — generate users, jobs, messages, sessions, and tenants on demand.
- **Stripe / Twilio sandboxes** — when a project needs a real third-party integration; both ship full test modes with fake data built in.

## LLM API access (Project 3, then 9 and 16–40)

From your first conversation loop (#3) onward, you need real model access — and from the tool-calling loop (#16) on, you need it constantly.

- **Anthropic API key** — primary. The repo leans on the Anthropic SDK + MCP. Develop against a cheap model (Haiku) and only run the expensive one for final numbers.
- **OpenAI API key** — fine alternative, and handy for embeddings.
- **Ollama (local)** — run a small open model offline for free iteration on agent/eval loops; switch to a hosted model for final quality.
- **Set a hard spend cap** on the API dashboards *before* you start looping agents — see the tips below.

## Text corpora — tokenizer training (Project 25)

Plain text to train BPE merges on.

- **Project Gutenberg** — clean public-domain books.
- **A Wikipedia dump** (or a subset) — large and varied.
- **A folder of source code** — see how code tokenizes versus prose.
- **TinyStories** — small, fast to iterate on.

## Document corpora — RAG (Project 24)

Things to chunk, embed, and retrieve over. Store vectors in Postgres + **pgvector** (reuse the DB from #7/#8).

- **A documentation site** (a framework's docs, or your own repo) — realistic, and you can judge answer quality yourself.
- **Wikipedia articles / arXiv papers** — varied and citeable.
- **SEC filings or public financial reports** — fintech flavor; dense text that's worth retrieving well.

## Eval datasets (Project 26)

Labeled examples to grade agent output against.

- **Hand-build a small golden set** (20–50 examples) — highest signal, and you learn the most. Start here.
- **Public sets** — SQuAD / HotpotQA (QA) or a GSM8K subset (reasoning) for a known baseline.
- **LLM-synthesized then hand-verified** — fast way to bootstrap, but always eyeball the labels.

## Tools & targets for agents (Projects 16, 30, 34, 36)

Things an agent can actually act on.

- **A local Postgres / filesystem** — a safe, real surface for tools and for your MCP server (#30).
- **Public read-only APIs** — GitHub, weather, exchange rates — easy tool wrappers for the agent loop (#16).
- **Stripe / Twilio sandboxes** — side-effecting tools without real consequences; also good for the sandboxed executor (#34).
- **For the vertical capstone (#36):** a domain dataset matched to the workflow you pick — public support tickets, compliance docs, invoices, etc.

---

## Practical tips

1. **Streaming projects: pick data larger than your RAM.** If your laptop has 16 GB and you stream a 500 MB file, you won't hit any of the bugs streaming exists to prevent — the whole thing fits in a buffer and works by accident.

2. **Never commit data.** Keep a gitignored `data/` folder in every repo and commit a `scripts/fetch-data.sh` that downloads on demand. GitHub will yell at you otherwise, and the repo becomes painful to clone.

3. **Cap your LLM spend before looping.** Agents and eval harnesses call models in loops, and a runaway loop is an expensive surprise. Set a hard monthly cap on the Anthropic/OpenAI dashboard, develop against a cheap or local model, and reserve the expensive model for final runs.
