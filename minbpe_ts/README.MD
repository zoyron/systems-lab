# minbpe_ts

A minimal **Byte Pair Encoding (BPE) tokenizer**, built from scratch in **TypeScript** — an idiomatic port of Andrej Karpathy's [`minbpe`](https://github.com/karpathy/minbpe) `BasicTokenizer`.

## What it is

A **tokenizer** is the translation layer between human text and the numbers a language model actually reads. It turns text into a list of integers ("tokens") and back. When a chat app tells you "you've used 1,200 tokens," a tokenizer is what counted them.

This project implements the `BasicTokenizer` — the three core operations of any tokenizer:

```
train(text)   →  learn the merges from a corpus
encode(text)  →  text → number[]
decode(ids)   →  number[] → text
```

There is **no machine learning** here. BPE is a pure algorithm: counting and merging.

## Why we made it

This is a **learning project** with two goals:

1. **Understand tokenization / BPE deeply** by rebuilding it from scratch instead of treating it as a black box. It demystifies context windows, token counts, and cost.
2. **Practice idiomatic TypeScript** — this is a real port (a TS-native design), not a line-by-line transliteration of the Python.

## How it works

BPE's whole idea is **shorthand**: repeatedly find the most common neighboring pair of symbols and replace every occurrence with a single new symbol. Do that N times and you've built a vocabulary of chunks.

It runs on the raw **UTF-8 bytes** of the text, so any input — any language, emoji, anything — starts life as a simple list of numbers `0–255`. New merges mint new ids (`256`, `257`, …).

```
text ─▶ [to bytes] ─▶ [numbers] ─▶ ( train: count → merge → repeat ) ─▶ [tokens] ─▶ [to text] ─▶ text
```

The implementation lives in [`src/tokenizer.ts`](src/tokenizer.ts):

| Piece | Role |
|---|---|
| `textToBytes` / `bytesToText` | text ↔ raw UTF-8 bytes |
| `getStats(ids)` | count every adjacent pair |
| `merge(ids, pair, newId)` | replace a pair everywhere with a new id |
| `BasicTokenizer.train()` | the greedy loop: count → take the top pair → mint an id → merge → record |
| `BasicTokenizer.encode()` | apply the learned merges, earliest-learned first |
| `BasicTokenizer.decode()` | map ids back to bytes → text |

## How to run

Install dependencies:

```bash
npm install
```

**Demo** — reproduces the canonical Wikipedia BPE example (`"aaabdaaabac"` → `[258, 100, 258, 97, 99]`):

```bash
npm run dev
```

**CLI** — train on a real text file, then encode/decode it and report the stats:

```bash
npm run cli -- <path/to/file.txt> [vocabSize]
```

Example:

```bash
npm run cli -- ./mytext.txt 512
```

Output:

```
file:         ./mytext.txt
vocab size:   512  (256 merges learned)
raw bytes:    185768
tokens:       78746
compression:  2.36x
round-trips:  ✅ yes (decoded === original)
first tokens: [67, 364, 273, 112, 97, 339, 256, 443, 87, 105 ...]
```

`round-trips: ✅ yes` confirms that `decode(encode(file))` reconstructs the original file exactly. A larger `vocabSize` learns more merges and compresses further.

## Credits & references

This is a port of Andrej Karpathy's work:

- 📺 **Video:** [Let's build the GPT Tokenizer](https://www.youtube.com/watch?v=zduSFxRajkE) — Andrej Karpathy
- 🐍 **Python source:** [karpathy/minbpe](https://github.com/karpathy/minbpe)
