import type { ParserResult } from '../parser/types';

export function buildRepositoryDetails(result: Pick<ParserResult, 'files' | 'edges'>) {
  const files = new Map(result.files.map(file => [file.path, file]));
  const importedBy = new Map<string, Set<string>>();
  const imports = new Map<string, Set<string>>();

  for (const { source, target } of result.edges) {
    addNeighbour(imports, source, target);
    addNeighbour(importedBy, target, source);
  }

  const rankedFiles = result.files.map(file => ({
    path: file.path,
    incoming: importedBy.get(file.path)?.size ?? 0,
    outgoing: imports.get(file.path)?.size ?? 0,
  }));
  const byPath = (a: { path: string }, b: { path: string }) => a.path.localeCompare(b.path);

  return {
    files,
    importedBy,
    imports,
    mostImported: rankedFiles.filter(file => file.incoming > 0)
      .sort((a, b) => b.incoming - a.incoming || byPath(a, b)).slice(0, 10),
    readingStarts: rankedFiles.filter(file => file.incoming === 0)
      .sort((a, b) => b.outgoing - a.outgoing || byPath(a, b)),
    unclassified: result.files.filter(file => file.role === null).length,
  };
}

function addNeighbour(index: Map<string, Set<string>>, file: string, neighbour: string) {
  const paths = index.get(file);
  if (paths) paths.add(neighbour);
  else index.set(file, new Set([neighbour]));
}
