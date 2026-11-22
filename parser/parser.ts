import { createHash } from "node:crypto";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { Node, Project, ScriptTarget, SyntaxKind, ts, type SourceFile } from "ts-morph";
import { fallbackAdapter, type FrameworkAdapter } from "./adapter.ts";
import { addGraphMetrics, deduplicateEdges } from "./graph.ts";
import type { CoverageReport, DependencyEdge, ImportCoverage, ImportKind, ModuleKind, ParsedFile, ParserResult, SkippedFile } from "./types.ts";

const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
const excludedDirectories = new Set([".git", ".next", ".turbo", "build", "coverage", "dist", "node_modules", "out"]);

type ParseRepositoryOptions = { adapter?: FrameworkAdapter };
type FoundFile = { absolutePath: string; relativePath: string };

export async function parseRepository(directory: string, options: ParseRepositoryOptions = {}): Promise<ParserResult> {
  const root = await validateRoot(directory);
  const adapter = options.adapter ?? fallbackAdapter;
  const foundFiles = await walkRepository(root);
  const skippedFiles: SkippedFile[] = [];
  const sourceFiles: FoundFile[] = [];
  for (const file of foundFiles) {
    const extension = path.extname(file.relativePath).toLowerCase();
    if (sourceExtensions.has(extension)) sourceFiles.push(file);
    else skippedFiles.push({ path: file.relativePath, reason: "unsupported extension" });
  }

  const project = createProject(root);
  const parsedSources = new Map<string, SourceFile>();
  for (const file of sourceFiles) {
    try {
      parsedSources.set(normalizeAbsolute(file.absolutePath), project.addSourceFileAtPath(file.absolutePath));
    } catch (error) {
      skippedFiles.push({ path: file.relativePath, reason: `parser rejected file: ${errorMessage(error)}` });
    }
  }

  const parsedPaths = new Set(parsedSources.keys());
  const files: ParsedFile[] = [];
  const rawEdges: DependencyEdge[] = [];
  const importCoverage: ImportCoverage[] = [];

  for (const file of sourceFiles) {
    const absolutePath = normalizeAbsolute(file.absolutePath);
    const sourceFile = parsedSources.get(absolutePath);
    if (!sourceFile) continue;
    const text = await readFile(absolutePath, "utf8");
    files.push({
      path: file.relativePath,
      folder: folderFor(file.relativePath),
      extension: path.extname(file.relativePath).toLowerCase(),
      moduleKind: moduleKind(sourceFile, file.relativePath),
      role: adapter.classifyFile(file.relativePath, sourceFile),
      lines: lineCount(text),
      hash: createHash("sha256").update(text).digest("hex"),
      fanIn: 0,
      fanOut: 0,
    });

    for (const declaration of sourceFile.getImportDeclarations()) {
      resolveImport(root, project, parsedPaths, file.relativePath, absolutePath, "import", declaration.getModuleSpecifierValue(), rawEdges, importCoverage);
    }
    for (const declaration of sourceFile.getExportDeclarations()) {
      const specifier = declaration.getModuleSpecifierValue();
      if (specifier) resolveImport(root, project, parsedPaths, file.relativePath, absolutePath, "re-export", specifier, rawEdges, importCoverage);
    }
    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue;
      const argument = call.getArguments()[0];
      if (!argument || (!Node.isStringLiteral(argument) && !Node.isNoSubstitutionTemplateLiteral(argument))) {
        importCoverage.push({ source: file.relativePath, kind: "dynamic-import", specifier: "<non-literal>", outcome: "excluded", reason: "dynamic import is not a literal string" });
        continue;
      }
      resolveImport(root, project, parsedPaths, file.relativePath, absolutePath, "dynamic-import", argument.getLiteralText(), rawEdges, importCoverage);
    }
  }

  const edges = deduplicateEdges(rawEdges);
  const coverage = coverageReport(foundFiles.length, files.length, skippedFiles, importCoverage);
  if (coverage.filesParsed + coverage.filesSkipped !== coverage.filesFound) {
    throw new Error("File coverage invariant failed: parsed plus skipped must equal found.");
  }
  return { version: 1, root, generatedAt: new Date().toISOString(), adapter: adapter.name,
    files: addGraphMetrics(files.sort((a, b) => a.path.localeCompare(b.path)), edges), edges, coverage };
}

function createProject(root: string) {
  const tsConfigPath = path.join(root, "tsconfig.json");
  return new Project(ts.sys.fileExists(tsConfigPath)
    ? { tsConfigFilePath: tsConfigPath, skipAddingFilesFromTsConfig: true }
    : { compilerOptions: { allowJs: true, checkJs: false, jsx: ts.JsxEmit.Preserve, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ScriptTarget.ESNext } });
}

function resolveImport(root: string, project: Project, parsedPaths: Set<string>, source: string, sourceAbsolutePath: string,
  kind: ImportKind, specifier: string, edges: DependencyEdge[], coverage: ImportCoverage[]) {
  const resolution = ts.resolveModuleName(specifier, sourceAbsolutePath, project.getCompilerOptions(), ts.sys).resolvedModule;
  if (!resolution) {
    const excludedTarget = existingExcludedTarget(sourceAbsolutePath, specifier);
    if (excludedTarget) {
      coverage.push({ source, kind, specifier, outcome: "excluded", target: relativePath(root, excludedTarget), reason: "resolved file type is deliberately excluded" });
      return;
    }
    const external = isExternalSpecifier(specifier, project.getCompilerOptions());
    coverage.push({ source, kind, specifier, outcome: external ? "external" : "unresolved",
      reason: external ? "package or runtime module" : "TypeScript could not resolve the module" });
    return;
  }
  const resolvedPath = normalizeAbsolute(resolution.resolvedFileName);
  if (isInExcludedDirectory(root, resolvedPath)) {
    coverage.push({ source, kind, specifier, outcome: "external", reason: "resolved dependency is outside the repository source set" });
    return;
  }
  if (!isInside(root, resolvedPath)) {
    coverage.push({ source, kind, specifier, outcome: "external", reason: "resolved outside repository" });
    return;
  }
  const target = relativePath(root, resolvedPath);
  if (!parsedPaths.has(resolvedPath)) {
    coverage.push({ source, kind, specifier, outcome: "excluded", target, reason: "resolved file is not a parsed source file" });
    return;
  }
  coverage.push({ source, kind, specifier, outcome: "resolved", target });
  edges.push({ source, target, kind, specifier });
}

async function validateRoot(directory: string) {
  const root = await realpath(path.resolve(directory));
  if (!(await stat(root)).isDirectory()) throw new Error(`${directory} is not a directory.`);
  return normalizeAbsolute(root);
}

async function walkRepository(root: string) {
  const found: FoundFile[] = [];
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    if (!directory) break;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(absolutePath);
      else found.push({ absolutePath: normalizeAbsolute(absolutePath), relativePath: relativePath(root, absolutePath) });
    }
  }
  return found.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function coverageReport(filesFound: number, filesParsed: number, skippedFiles: SkippedFile[], imports: ImportCoverage[]): CoverageReport {
  const skipReasons: Record<string, number> = {};
  for (const skipped of skippedFiles) skipReasons[skipped.reason] = (skipReasons[skipped.reason] ?? 0) + 1;
  return { filesFound, filesParsed, filesSkipped: skippedFiles.length, skipReasons, skippedFiles,
    importsSeen: imports.length, importsResolved: countOutcome(imports, "resolved"), importsExternal: countOutcome(imports, "external"),
    importsExcluded: countOutcome(imports, "excluded"), importsUnresolved: countOutcome(imports, "unresolved"),
    reExportsSeen: imports.filter((item) => item.kind === "re-export").length,
    reExportsResolved: imports.filter((item) => item.kind === "re-export" && item.outcome === "resolved").length, imports };
}

function countOutcome(imports: ImportCoverage[], outcome: ImportCoverage["outcome"]) {
  return imports.filter((item) => item.outcome === outcome).length;
}

function moduleKind(sourceFile: SourceFile, filePath: string): ModuleKind {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".cjs" || extension === ".cts") return "commonjs";
  if (sourceFile.getImportDeclarations().length > 0 || sourceFile.getExportDeclarations().length > 0 || sourceFile.getExportSymbols().length > 0) return "es-module";
  return "script";
}

function isExternalSpecifier(specifier: string, compilerOptions: ts.CompilerOptions) {
  if (specifier.startsWith(".") || path.isAbsolute(specifier)) return false;
  return !Object.keys(compilerOptions.paths ?? {}).some((alias) => matchesAlias(alias, specifier));
}

function matchesAlias(alias: string, specifier: string) {
  if (!alias.includes("*")) return alias === specifier;
  const [prefix, suffix] = alias.split("*");
  return specifier.startsWith(prefix) && specifier.endsWith(suffix ?? "");
}

function existingExcludedTarget(sourceAbsolutePath: string, specifier: string) {
  if (!specifier.startsWith(".")) return null;
  const candidate = normalizeAbsolute(path.resolve(path.dirname(sourceAbsolutePath), specifier));
  return ts.sys.fileExists(candidate) ? candidate : null;
}

function isInExcludedDirectory(root: string, target: string) {
  const parts = path.relative(root, target).split(path.sep);
  return parts.some((part) => excludedDirectories.has(part));
}

function isInside(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}
function relativePath(root: string, target: string) { return path.relative(root, target).split(path.sep).join("/"); }
function folderFor(filePath: string) { const folder = path.posix.dirname(filePath); return folder === "." ? "." : folder; }
function normalizeAbsolute(value: string) { return path.resolve(value); }
function lineCount(text: string) { return text.length === 0 ? 0 : text.split(/\r\n|\n|\r/).length; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }
