import type { ParsedFile, DependencyEdge } from '../parser/types';

const parent = (path: string) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.';
export function fold(files: ParsedFile[], edges: DependencyEdge[]) {
  const pass = (threshold: number) => {
    const groups = new Map<string, ParsedFile[]>();
    for (const file of files) {
      let folder = file.folder || '.';
      groups.set(folder, [...(groups.get(folder) ?? []), file]);
      while (folder !== '.') { folder = parent(folder); if (!groups.has(folder)) groups.set(folder, []); }
    }
    const depths = [...new Set([...groups.keys()].map(p => p === '.' ? 0 : p.split('/').length))].sort((a,b) => b-a);
    for (const depth of depths) {
      const merges = [...groups].filter(([p, fs]) => p !== '.' && p.split('/').length === depth && fs.length < threshold);
      for (const [p, fs] of merges) { const up = parent(p); groups.set(up, [...(groups.get(up) ?? []), ...fs]); groups.delete(p); }
    }
    return [...groups].filter(([, fs]) => fs.length).sort(([a],[b]) => a.localeCompare(b));
  };
  let threshold = 2;
  let groups = pass(threshold);
  while (groups.length > 24 && threshold <= files.length) groups = pass(++threshold);
  const owner = new Map(groups.flatMap(([id, fs]) => fs.map(f => [f.path, id] as const)));
  const modules = groups.map(([id, fs]) => {
    const incoming = new Set<string>(); const outgoing = new Set<string>();
    for (const edge of edges) {
      if (owner.get(edge.target) === id && owner.get(edge.source) !== id) incoming.add(edge.source);
      if (owner.get(edge.source) === id && owner.get(edge.target) !== id) outgoing.add(edge.target);
    }
    const parts = id.split('/'); let label = id;
    for (let n=1;n<=parts.length;n++) { const suffix=parts.slice(-n).join('/'); if (groups.filter(([p]) => p===suffix || p.endsWith('/'+suffix)).length===1) {label=suffix;break;} }
    return { id, label, files: fs.sort((a,b)=>a.path.localeCompare(b.path)), fanIn: incoming.size, fanOut: outgoing.size };
  });
  return { modules, owner, threshold };
}
