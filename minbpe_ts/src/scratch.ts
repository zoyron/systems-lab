import { BasicTokenizer } from "./tokenizer.js";

// The canonical Wikipedia BPE example: "aaabdaaabac" with 3 merges.
const t = new BasicTokenizer();
t.train("aaabdaaabac", 256 + 3, true);

const encoded = t.encode("aaabdaaabac");
console.log("encoded:", encoded); // [258, 100, 258, 97, 99]
console.log("decoded:", t.decode(encoded)); // aaabdaaabac
console.log("round-trips:", t.decode(encoded) === "aaabdaaabac");

// And it works on real unicode too:
const t2 = new BasicTokenizer();
t2.train("the quick brown fox jumps over the lazy dog. ".repeat(20), 256 + 50);
const sample = "the lazy dog 👋";
console.log("unicode round-trips:", t2.decode(t2.encode(sample)) === sample);
