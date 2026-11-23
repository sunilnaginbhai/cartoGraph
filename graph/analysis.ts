import type { DependencyEdge, ParsedFile } from '../parser/types';

export type WalkDirection = 'dependencies' | 'dependants';

export function walkGraph(start: string, edges: readonly DependencyEdge[], direction: WalkDirection, depth = 2) {
  const neighbours = new Map<string, Set<string>>();
  for (const edge of edges) {
    const from = direction === 'dependencies' ? edge.source : edge.target;
    const to = direction === 'dependencies' ? edge.target : edge.source;
    const current = neighbours.get(from);
    if (current) current.add(to);
    else neighbours.set(from, new Set([to]));
  }
  const found = new Map<string, number>();
  let frontier = new Set([start]);
  for (let level = 1; level <= depth && frontier.size > 0; level += 1) {
    const next = new Set<string>();
    for (const path of frontier) for (const neighbour of neighbours.get(path) ?? []) {
      if (neighbour === start || found.has(neighbour)) continue;
      found.set(neighbour, level);
      next.add(neighbour);
    }
    frontier = next;
  }
  return [...found].map(([path, distance]) => ({ path, distance }))
    .sort((a, b) => a.distance - b.distance || a.path.localeCompare(b.path));
}

export function findRepositoryInsights(files: readonly ParsedFile[], edges: readonly DependencyEdge[]) {
  const incoming = new Map(files.map(file => [file.path, 0]));
  for (const edge of edges) incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  const counts = [...incoming.values()].sort((a, b) => a - b);
  const lower = quartile(counts, 0.25);
  const upper = quartile(counts, 0.75);
  const upperFence = upper + 1.5 * (upper - lower);
  const byPath = (a: string, b: string) => a.localeCompare(b);
  return {
    unimported: files.filter(file => incoming.get(file.path) === 0 && !isFrameworkEntry(file)).map(file => file.path).sort(byPath),
    highlyImported: files.map(file => ({ path: file.path, incoming: incoming.get(file.path) ?? 0 }))
      .filter(file => file.incoming > upperFence && file.incoming > 0)
      .sort((a, b) => b.incoming - a.incoming || byPath(a.path, b.path)),
    cycles: findCycles(files.map(file => file.path), edges),
    oversized: files.filter(file => file.lines > 500).map(file => ({ path: file.path, lines: file.lines }))
      .sort((a, b) => b.lines - a.lines || byPath(a.path, b.path)),
  };
}

function quartile(sorted: readonly number[], fraction: number) {
  if (sorted.length === 0) return 0;
  return sorted[Math.floor((sorted.length - 1) * fraction)] ?? 0;
}

function isFrameworkEntry(file: ParsedFile) {
  const name = file.path.split('/').at(-1)?.replace(/\.[^.]+$/, '').toLowerCase() ?? '';
  const role = file.role?.toLowerCase() ?? '';
  return ['page', 'route', 'layout', 'middleware', 'config'].some(kind => name === kind || name.endsWith(`.${kind}`) || role.includes(kind));
}

function findCycles(paths: readonly string[], edges: readonly DependencyEdge[]) {
  const forward = adjacency(paths, edges, false);
  const reverse = adjacency(paths, edges, true);
  const visited = new Set<string>();
  const order: string[] = [];
  for (const start of paths) {
    if (visited.has(start)) continue;
    const stack: { path: string; expanded: boolean }[] = [{ path: start, expanded: false }];
    while (stack.length > 0) {
      const item = stack.pop();
      if (!item) break;
      if (item.expanded) { order.push(item.path); continue; }
      if (visited.has(item.path)) continue;
      visited.add(item.path);
      stack.push({ path: item.path, expanded: true });
      for (const next of forward.get(item.path) ?? []) if (!visited.has(next)) stack.push({ path: next, expanded: false });
    }
  }
  const assigned = new Set<string>();
  const cycles: string[][] = [];
  for (let index = order.length - 1; index >= 0; index -= 1) {
    const start = order[index];
    if (!start || assigned.has(start)) continue;
    const component: string[] = [];
    const stack = [start];
    assigned.add(start);
    while (stack.length > 0) {
      const path = stack.pop();
      if (!path) break;
      component.push(path);
      for (const next of reverse.get(path) ?? []) if (!assigned.has(next)) { assigned.add(next); stack.push(next); }
    }
    const only = component[0] ?? '';
    if (component.length > 1 || (forward.get(only) ?? new Set()).has(only)) cycles.push(component.sort(byPath));
  }
  return cycles.sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''));
}

function byPath(a: string, b: string) { return a.localeCompare(b); }

function adjacency(paths: readonly string[], edges: readonly DependencyEdge[], reversed: boolean) {
  const map = new Map(paths.map(path => [path, new Set<string>()]));
  for (const edge of edges) map.get(reversed ? edge.target : edge.source)?.add(reversed ? edge.source : edge.target);
  return map;
}
