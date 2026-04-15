import process from "process";
import path from "path";
import fs from "fs";
import {readFile} from "fs/promises";
import {Command} from 'commander';

const program  = new Command();

program
.name('file-analyzer')
.description("A robust CLI tool to analyze CSV nad JSON files")
.version("1.0.0");

program
.argument("<file>", "path to the file to analyze")
.action(async (file:string) => {
  // resolve the absolute path of the file
  // this turns 'data.csv' into "/Users/username/project/data.csv"
  const filePath = path.resolve(file);

  // Check does this file actually exist
  if (!fs.existsSync(filePath)){
    console.error(`Error: The file "${file}" does not exist.`);
    process.exit(1);
  }

  // check: is it a support file type or not
  const ext = path.extname(filePath).toLowerCase();

  if(ext !== '.csv' && ext !== ".json"){
    console.error(`Error: Unsupported file type "${ext}". Only .csv and .json are suported.`);
    process.exit(1);
  }

  console.log(`Processing ${ext.toUpperCase()}...`);

  try {
    /**
     * Read the file text.
     * Here we ask the OS to read the file, and as the OS reading the file and sending us back a promise, the sync things in the call stack will start getting executed.
     * And after the OS has read the file, this will be sent to the event loop queue. and when the stack is emptied, only then the things from event loop are sent to the stack to get executed.
     */
    const rawContent = await readFile(filePath, "utf-8");
    let data: any[] = [];

    if (ext === ".json"){
      // Parse json string into a javascript object
      const parsedData = JSON.parse(rawContent);

      // ensure that data is an array even if the JSON was just one object.
      data = Array.isArray(parsedData) ? parsedData : [parsedData];
    } else{
      console.log("CSV reading logic coming in the next step");
    }

    // basic results about the analyzed data
    console.log("----Analysis Result----");
    console.log(`Total Rows Found: ${data.length}`);
  } catch (error: any) {
   console.error(`Error reading or parsing file: ${error.message}`);
   process.exit(1);
  }
});

// THis tells the program to actually look at what you typed in the terminal.
program.parse(process.argv);