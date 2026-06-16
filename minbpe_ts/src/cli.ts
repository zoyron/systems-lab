import { readFileSync } from "node:fs";
import { BasicTokenizer, textToBytes } from "./tokenizer.js";

// argv[0]=node, argv[1]=script, argv[2]=file, argv[3]=vocabSize
const [, , filePath, vocabArg] = process.argv;

if (!filePath) {
  console.error("usage: npm run cli -- <file.txt> [vocabSize=512]");
  process.exit(1);
}

const vocabSize = vocabArg ? Number(vocabArg) : 512;
const text = readFileSync(filePath, "utf-8");

const t = new BasicTokenizer();
t.train(text, vocabSize);

const encoded = t.encode(text);
const decoded = t.decode(encoded);
const rawBytes = textToBytes(text).length;

console.log(`file:         ${filePath}`);
console.log(`vocab size:   ${vocabSize}  (${vocabSize - 256} merges learned)`);
console.log(`raw bytes:    ${rawBytes}`);
console.log(`tokens:       ${encoded.length}`);
console.log(`compression:  ${(rawBytes / encoded.length).toFixed(2)}x`);
console.log(`round-trips:  ${decoded === text ? "✅ yes (decoded === original)" : "❌ NO"}`);
console.log(`first tokens: [${encoded.slice(0, 20).join(", ")} ...]`);
