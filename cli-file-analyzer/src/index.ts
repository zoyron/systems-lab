import process from "process";
import path from "path";
import fs from "fs";
import {Command} from 'commander';

const program  = new Command();

program
.name('file-analyzer')
.description("A robust CLI tool to analyze CSV nad JSON files")
.version("1.0.0");

program
.argument("<file>", "path to the file to analyze")
.action((file:string) => {
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

  console.log(`Analysing ${ext.toUpperCase()} file at: ${filePath}`);
});

// THis tells the program to actually look at what you typed in the terminal.
program.parse(process.argv);