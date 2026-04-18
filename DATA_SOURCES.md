# Data Sources

Where to source data for the projects in this repo, organized by what you're actually feeding the project.

## Large CSV/JSON (Projects 3, 4, 10 — streaming, chunking, logs)

- **NYC Taxi Trip Records** (nyc.gov/site/tlc/about/tlc-trip-record-data) — monthly files run 2–5 GB, perfect for forcing actual streaming. The classic pick.
- **GitHub Archive** (gharchive.org) — newline-delimited JSON of public GitHub events, ~1–2 GB/day. Great for streaming + later as a Kafka feed.
- **Loghub** (github.com/logpai/loghub) — real production log datasets (Hadoop, Apache, SSH, etc.) for Project 10 and #20.
- **Common Crawl** — if you want insane scale later.

## Time-series / sensor (Projects 14, 16, 17, 19)

- Start synthetic with Faker.js — you control rate, gaps, anomalies. That's the point of #14 anyway.
- Real: **NOAA weather station archives**, UCI ML Repository sensor datasets.

## Relational (Projects 6, 12, 18, 24)

- **Kaggle** for messy real data (e-commerce, movies, Olympics — tons of multi-table candidates).
- **Sakila** (MySQL) or **Chinook** (any DB) as pre-built sample schemas if you just want to practice queries fast.

## Large files for S3 / uploads (Projects 7, 8, 9)

- Anything big: Wikipedia dumps, public video files, Linux ISOs. Don't overthink this.

## KV store (Project 5) and auth/RBAC/product projects (A1, A3, P1)

- Just generate with Faker.js. Realism doesn't matter — read/write *patterns* do.

## Third-party integrations (when you get to them)

- Stripe and Twilio both have full test/sandbox modes with fake data built in.

---

## Two Practical Tips

1. For streaming projects specifically, pick data **larger than your RAM**. If your laptop has 16 GB and you use a 500 MB file, you won't discover any of the bugs streaming is supposed to prevent — the whole thing fits in a buffer and works by accident.

2. Keep a `data/` folder gitignored in every repo, and commit a `scripts/fetch-data.sh` that downloads on demand. Don't commit the data itself — GitHub will yell at you and your repo becomes painful to clone.
