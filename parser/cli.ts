import { writeFile } from "node:fs/promises";
import path from "node:path";
import { parseRepository } from "./parser.ts";
import { readParserResult } from "./result.ts";

const { directory, output } = argumentsFrom(process.argv.slice(2));
const result = await parseRepository(directory);
const folders = new Set(result.files.map((file) => file.folder));

console.log(`Root: ${result.root}`);
console.log(`Files: ${result.coverage.filesFound} found, ${result.coverage.filesParsed} parsed, ${result.coverage.filesSkipped} skipped`);
console.log(`Folders: ${folders.size}`);
console.log(`Edges: ${result.edges.length}`);
console.log(`Imports: ${result.coverage.importsSeen} seen, ${result.coverage.importsResolved} resolved, ${result.coverage.importsExternal} external, ${result.coverage.importsExcluded} excluded, ${result.coverage.importsUnresolved} unresolved`);
console.log(`Re-exports: ${result.coverage.reExportsSeen} seen, ${result.coverage.reExportsResolved} resolved`);
for (const [reason, count] of Object.entries(result.coverage.skipReasons)) console.log(`Skipped: ${count} ${reason}`);
for (const item of result.coverage.imports.filter((entry) => entry.outcome === "unresolved")) {
  console.log(`Unresolved: ${item.source} imports ${item.specifier}: ${item.reason}`);
}
if (output) {
  const outputPath = path.resolve(output);
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  const checked = await readParserResult(outputPath);
  console.log(`Output: ${outputPath} (contract v${checked.version} verified)`);
}

function argumentsFrom(args: string[]) {
  let directory = ".";
  let output: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--out") {
      output = args[index + 1];
      if (!output) throw new Error("--out requires a file path.");
      index += 1;
    } else if (argument === "--help") {
      console.log("Usage: pnpm parse [directory] [--out result.json]");
      process.exit(0);
    } else if (argument.startsWith("-")) throw new Error(`Unknown option: ${argument}`);
    else directory = argument;
  }
  return { directory, output };
}
