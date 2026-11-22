export type ImportKind = "import" | "re-export" | "dynamic-import";

export type ImportOutcome =
  | "resolved"
  | "external"
  | "excluded"
  | "unresolved";

export type ModuleKind = "es-module" | "commonjs" | "script";

export type ParsedFile = {
  path: string;
  folder: string;
  extension: string;
  moduleKind: ModuleKind;
  role: string | null;
  lines: number;
  hash: string;
  fanIn: number;
  fanOut: number;
};

export type DependencyEdge = {
  source: string;
  target: string;
  kind: ImportKind;
  specifier: string;
};

export type SkippedFile = { path: string; reason: string };

export type ImportCoverage = {
  source: string;
  kind: ImportKind;
  specifier: string;
  outcome: ImportOutcome;
  target?: string;
  reason?: string;
};

export type CoverageReport = {
  filesFound: number;
  filesParsed: number;
  filesSkipped: number;
  skipReasons: Record<string, number>;
  skippedFiles: SkippedFile[];
  importsSeen: number;
  importsResolved: number;
  importsExternal: number;
  importsExcluded: number;
  importsUnresolved: number;
  reExportsSeen: number;
  reExportsResolved: number;
  imports: ImportCoverage[];
};

export type ParserResult = {
  version: 1;
  root: string;
  generatedAt: string;
  adapter: string;
  files: ParsedFile[];
  edges: DependencyEdge[];
  coverage: CoverageReport;
};
