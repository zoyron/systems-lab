import process from "process";
import path from "path";
import fs from "fs";
import { readFile } from "fs/promises";
import { Command } from "commander";
import { parse } from "csv-parse/sync";
import chalk from "chalk";

const program = new Command();

program
  .name("file-analyzer")
  .description("A robust CLI tool to analyze CSV nad JSON files")
  .version("1.0.0");

program
  .argument("<file>", "path to the file to analyze")
  .action(async (file: string) => {
    // resolve the absolute path of the file
    // this turns 'data.csv' into "/Users/username/project/data.csv"
    const filePath = path.resolve(file);

    // Check does this file actually exist
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red.bold(`Error: The file "${file}" does not exist.`));
      process.exit(1);
    }

    // check: is it a support file type or not
    const ext = path.extname(filePath).toLowerCase();

    if (ext !== ".csv" && ext !== ".json") {
      console.error(
        chalk.red.bold(`Error: Unsupported file type "${ext}". Only .csv and .json are suported.`),
      );
      process.exit(1);
    }

    console.log(chalk.blue(`\n🔍 Processing ${ext.toUpperCase()}: ${filePath}...`));

    try {
      /**
       * Read the file text.
       * Here we ask the OS to read the file, and as the OS reading the file and sending us back a promise, the sync things in the call stack will start getting executed.
       * And after the OS has read the file, this will be sent to the event loop queue. and when the stack is emptied, only then the things from event loop are sent to the stack to get executed.
       */
      const rawContent = await readFile(filePath, "utf-8");
      let data: any[] = [];

      if (ext === ".json") {
        // Parse json string into a javascript object
        const parsedData = JSON.parse(rawContent);

        // ensure that data is an array even if the JSON was just one object.
        data = Array.isArray(parsedData) ? parsedData : [parsedData];
      } else if (ext === ".csv") {
        // Parse csv string into objects
        data = parse(rawContent, {
          columns: true,
          skip_empty_lines: true,
        });
      }

      // basic results about the analyzed data
      // before the following code executes, one must know that whether the input file is json or csv, data from both has been converted to an array format.
      console.log(chalk.cyan.bold("\n----- Analysis Result -----"));
      console.log(`${chalk.white("Total Rows Found:")} ${chalk.green.bold(data.length)}`);

      /**
       * Detect column name:
       * We look at the first object in our array to see what the property names are
       */

      const columns = data.length > 0 ? Object.keys(data[0]) : [];

      console.log(chalk.cyan.bold(`\n----- Schema Analysis -----`));
      console.log(`${chalk.white("columns found:")} ${columns.length} (${columns.join(", ")})`);

      // Analyze every column, one by one
      columns.forEach((col) => {
        let nullCount = 0;
        let isNumeric = true; // assume it's a number until proven otherwise.
        let isBoolean = true; // assume it's a boolean until proven otherwise.

        // for this specific column, check every single row(object)
        data.forEach((row) => {
          const value = row[col];

          // in data engineering, we usually count null, undefined, or empty strings as 'missing'
          if (value === null || value === undefined || value === "") {
            nullCount++;
          } else {
            // check if it's not an number
            // here we are sending the 'value' variable inside the Number method
            // after that we are checking with isNaN whether the result given by the Number method is actually a number of not.
            if (isNaN(Number(value))) {
              isNumeric = false;
            }
            // Check if it's NOT a Boolean
            // Booleans in data are usually 'true', 'false', '0', or '1'
            const lowerValue = String(value).toLowerCase();
            if (
              lowerValue !== "true" &&
              lowerValue !== "false" &&
              lowerValue !== "0" &&
              lowerValue !== "1"
            ) {
              isBoolean = false;
            }
          }
        });

        // Determine Final Type Name
        let detectedType = "String";
        if (data.length > nullCount) {
          // Only detect if we have at least one non-null value
          if (isNumeric) {
            detectedType = "Number";
          } else if (isBoolean) {
            detectedType = "Boolean";
          }
        }
        const nullPercentage = ((nullCount / data.length) * 100).toFixed(1);

        const typeDisplay = chalk.yellow.bold(detectedType.padEnd(7));
        const nullDisplay = nullCount > 0 ? chalk.red.bold(nullCount) : chalk.green.bold(nullCount);

        console.log(
          `${chalk.blue.bold(`[${col.padEnd(10)}]`)} | Type: ${typeDisplay} | Missing: ${nullDisplay} (${nullPercentage}%)`,
        );
      });

      console.log(chalk.green.bold(`\n✅ Analysis successfully completed!\n`));
    } catch (error: any) {
      console.error(chalk.red.bold(`\n❌ Error reading or parsing file: ${error.message}`));
      process.exit(1);
    }
  });

// THis tells the program to actually look at what you typed in the terminal.
program.parse(process.argv);
