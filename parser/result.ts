import { readFile } from "node:fs/promises";
import type { ParserResult } from "./types.ts";

export async function readParserResult(path: string): Promise<ParserResult> {
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!isParserResult(value)) {
    throw new Error(`Parser output at ${path} does not match contract version 1.`);
  }
  return value;
}

export function isParserResult(value: unknown): value is ParserResult {
  if (!isRecord(value)) return false;
  return value.version === 1 && typeof value.root === "string" &&
    typeof value.generatedAt === "string" && typeof value.adapter === "string" &&
    Array.isArray(value.files) && value.files.every(isParsedFile) &&
    Array.isArray(value.edges) && value.edges.every(isEdge) && isCoverage(value.coverage);
}

function isParsedFile(value: unknown) {
  if (!isRecord(value)) return false;
  return typeof value.path === "string" && typeof value.folder === "string" &&
    typeof value.extension === "string" && ["es-module", "commonjs", "script"].includes(String(value.moduleKind)) &&
    (value.role === null || typeof value.role === "string") && isNumber(value.lines) &&
    typeof value.hash === "string" && isNumber(value.fanIn) && isNumber(value.fanOut);
}

function isEdge(value: unknown) {
  return isRecord(value) && typeof value.source === "string" && typeof value.target === "string" &&
    ["import", "re-export", "dynamic-import"].includes(String(value.kind)) && typeof value.specifier === "string";
}

function isCoverage(value: unknown) {
  if (!isRecord(value)) return false;
  const numericKeys = ["filesFound", "filesParsed", "filesSkipped", "importsSeen", "importsResolved", "importsExternal", "importsExcluded", "importsUnresolved", "reExportsSeen", "reExportsResolved"];
  return numericKeys.every((key) => isNumber(value[key])) && isRecord(value.skipReasons) &&
    Object.values(value.skipReasons).every(isNumber) && Array.isArray(value.skippedFiles) &&
    value.skippedFiles.every(isSkippedFile) && Array.isArray(value.imports) && value.imports.every(isImportCoverage);
}

function isSkippedFile(value: unknown) {
  return isRecord(value) && typeof value.path === "string" && typeof value.reason === "string";
}

function isImportCoverage(value: unknown) {
  return isRecord(value) && typeof value.source === "string" &&
    ["import", "re-export", "dynamic-import"].includes(String(value.kind)) && typeof value.specifier === "string" &&
    ["resolved", "external", "excluded", "unresolved"].includes(String(value.outcome)) &&
    (value.target === undefined || typeof value.target === "string") &&
    (value.reason === undefined || typeof value.reason === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}
