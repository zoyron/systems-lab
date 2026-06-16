import { createReadStream, createWriteStream } from "fs";
import { parse } from "csv-parse";
import { stringify } from "csv-stringify";

// this is an empty object to be filled as the chunks are created(this is an example comment)
// this step converts the raw raw csv text to array/objects

// create the full pipeline
export function pipeCsvThrough(inputPath: string, outputPath: string): void {
  const csvParser = parse({ columns: true });

  // create the stringifier transform stream
  // this step converts arrays/objects to csv text
  const csvStringifier = stringify({ header: true }); // include the header row in output
  const readStream = createReadStream(inputPath, { encoding: "utf8" });
  const writeStream = createWriteStream(outputPath, { encoding: "utf8" });

  // pipe() connects streams: read -> parse -> stringify -> writre
  // it also handles backpressure automatically
  readStream.pipe(csvParser).pipe(csvStringifier).pipe(writeStream);

  // write errors at each step
  readStream.on("error", (err) => console.error("Read error:", err.message));
  csvParser.on("error", (err) => console.error("Parse error:", err.message));
  csvStringifier.on("error", (err) =>
    console.error("Stringify error:", err.message),
  );
  writeStream.on("error", (err) => console.error("Write error:", err.message));
}
