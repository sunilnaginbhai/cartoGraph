import { readFile } from "node:fs/promises";
import type { ParserResult } from "./types.ts";
import { isParserResult } from "./validate.ts";
export { isParserResult } from "./validate.ts";

export async function readParserResult(path: string): Promise<ParserResult> {
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!isParserResult(value)) {
    throw new Error(`Parser output at ${path} does not match contract version 1.`);
  }
  return value;
}

