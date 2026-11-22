import type { DependencyEdge, ParsedFile } from "./types.ts";

export function deduplicateEdges(edges: DependencyEdge[]) {
  const unique = new Map<string, DependencyEdge>();
  for (const edge of edges) {
    const key = `${edge.source}\u0000${edge.target}\u0000${edge.kind}`;
    if (!unique.has(key)) unique.set(key, edge);
  }
  return [...unique.values()].sort(compareEdges);
}

export function addGraphMetrics(files: ParsedFile[], edges: DependencyEdge[]) {
  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();
  for (const edge of edges) {
    mapSet(outgoing, edge.source).add(edge.target);
    mapSet(incoming, edge.target).add(edge.source);
  }
  return files.map((file) => ({
    ...file,
    fanIn: incoming.get(file.path)?.size ?? 0,
    fanOut: outgoing.get(file.path)?.size ?? 0,
  }));
}

function mapSet(map: Map<string, Set<string>>, key: string) {
  const existing = map.get(key);
  if (existing) return existing;
  const created = new Set<string>();
  map.set(key, created);
  return created;
}

function compareEdges(left: DependencyEdge, right: DependencyEdge) {
  return left.source.localeCompare(right.source) || left.target.localeCompare(right.target) || left.kind.localeCompare(right.kind);
}
