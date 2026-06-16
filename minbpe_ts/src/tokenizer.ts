// ============================================================================
// Byte layer — text <-> raw UTF-8 bytes (numbers 0..255)
// ============================================================================

// text -> list of byte values, via utf-8
// return type is number[] (not Uint8Array) because: (1) the list must grow /
// be spliced during merging, and Uint8Array is fixed-length; (2) token ids are
// about to climb past 255, and a Uint8Array slot can only hold 0..255.
export function textToBytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

// list of byte values -> text, via utf-8
export function bytesToText(bytes: number[]): string {
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

// ============================================================================
// Pair statistics — count every adjacent pair of ids
// ============================================================================

// Key is the string "a,b" because JS compares arrays by reference, not value,
// so an array can't be used as a Map key. Strings compare by value.
export function getStats(ids: number[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i < ids.length - 1; i++) {
    const pair = `${ids[i]},${ids[i + 1]}`;
    counts.set(pair, (counts.get(pair) ?? 0) + 1);
  }
  return counts;
}

// ============================================================================
// Merge — replace every (non-overlapping) occurrence of `pair` with `newId`
// ============================================================================

export function merge(
  ids: number[],
  pair: [number, number],
  newId: number,
): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < ids.length) {
    // if we're at the pair (and not at the very last element), collapse it
    if (i < ids.length - 1 && ids[i] === pair[0] && ids[i + 1] === pair[1]) {
      out.push(newId);
      i += 2; // skip both elements of the pair
    } else {
      out.push(ids[i]);
      i += 1;
    }
  }
  return out;
}

// ============================================================================
// Small internal helpers
// ============================================================================

// "97,98" -> [97, 98]
function parsePair(key: string): [number, number] {
  const comma = key.indexOf(",");
  return [Number(key.slice(0, comma)), Number(key.slice(comma + 1))];
}

// the key with the highest count; ties go to the first one seen (matches the
// reference implementation, since Map preserves insertion order)
function maxByValue(counts: Map<string, number>): string {
  let bestKey = "";
  let bestCount = -Infinity;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  }
  return bestKey;
}

// concatenate byte chunks into one Uint8Array
function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

// ============================================================================
// BasicTokenizer — train / encode / decode
// ============================================================================

export class BasicTokenizer {
  // learned merges: "a,b" -> new id. The id also doubles as the "rank"
  // (order learned), because ids are minted in increasing order 256, 257, ...
  private merges = new Map<string, number>();

  // every id -> the exact bytes it expands to. ids 0..255 are the raw bytes;
  // ids >= 256 are learned merges (built up during train).
  private vocab = new Map<number, Uint8Array>();

  constructor() {
    this.buildBaseVocab();
  }

  // seed the vocab with the 256 single-byte tokens
  private buildBaseVocab(): void {
    this.vocab = new Map();
    for (let i = 0; i < 256; i++) this.vocab.set(i, Uint8Array.of(i));
  }

  /**
   * Learn `vocabSize - 256` merges from `text`.
   * Each round: count pairs -> take the most common -> mint a new id ->
   * merge it everywhere -> record the merge and grow the vocab.
   */
  train(text: string, vocabSize: number, verbose = false): void {
    if (vocabSize < 256) {
      throw new Error(`vocabSize must be >= 256, got ${vocabSize}`);
    }
    const numMerges = vocabSize - 256;

    let ids = textToBytes(text);
    this.merges = new Map();
    this.buildBaseVocab();

    for (let i = 0; i < numMerges; i++) {
      const stats = getStats(ids);
      if (stats.size === 0) break; // sequence too short to merge further

      const topKey = maxByValue(stats);
      const pair = parsePair(topKey);
      const newId = 256 + i;

      ids = merge(ids, pair, newId);
      this.merges.set(topKey, newId);
      this.vocab.set(
        newId,
        concatBytes([this.vocab.get(pair[0])!, this.vocab.get(pair[1])!]),
      );

      if (verbose) {
        console.log(
          `merge ${i + 1}/${numMerges}: (${pair[0]},${pair[1]}) -> ${newId} ` +
            `(${stats.get(topKey)} occurrences)`,
        );
      }
    }
  }

  /**
   * Turn text into token ids by repeatedly applying the learned merges —
   * always applying the *earliest-learned* applicable merge first, until none
   * apply. (Order matters: a later merge may depend on an earlier one.)
   */
  encode(text: string): number[] {
    let ids = textToBytes(text);

    while (ids.length >= 2) {
      const stats = getStats(ids);

      // among the pairs currently present, pick the one with the lowest rank
      // (lowest id) — i.e. the one learned earliest.
      let bestKey: string | null = null;
      let bestRank = Infinity;
      for (const key of stats.keys()) {
        const rank = this.merges.get(key);
        if (rank !== undefined && rank < bestRank) {
          bestRank = rank;
          bestKey = key;
        }
      }

      if (bestKey === null) break; // no present pair is mergeable
      ids = merge(ids, parsePair(bestKey), bestRank);
    }

    return ids;
  }

  /** Turn token ids back into text via the vocab. */
  decode(ids: number[]): string {
    const chunks = ids.map((id) => {
      const bytes = this.vocab.get(id);
      if (bytes === undefined) throw new Error(`invalid token id: ${id}`);
      return bytes;
    });
    return new TextDecoder().decode(concatBytes(chunks));
  }
}
