import process from "process";
import {Command} from 'commander';

const program  = new Command();

program.name('file-analyzer').description("A robust CLI tool to analyze CSV nad JSON files").version("1.0.0");

program.argument("<file>", "path to the file to analyze").action((file:string) => {
  // this is the code that runs when teh user provides a file path
  console.log(`Successfully captured file path: ${file}`);
  console.log("Next, we'll check if this file actually exists");
});

// THis tells the program to actually look at what you typed in the terminal.
program.parse(process.argv);