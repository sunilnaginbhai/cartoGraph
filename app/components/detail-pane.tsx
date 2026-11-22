import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { ParserResult } from '../../parser/types';
import type { buildRepositoryDetails } from '../../graph/details';
import type { fold } from '../../graph/folding';
import styles from './detail-pane.module.css';

type Details = ReturnType<typeof buildRepositoryDetails>;
type Folder = ReturnType<typeof fold>['modules'][number];
type Tab = 'structure' | 'explanation';

type Props = {
  repository: string;
  result: ParserResult;
  details: Details;
  selection: string | null;
  folders: ReadonlyMap<string, Folder>;
  mapHover: string | null;
  owners: ReadonlyMap<string, string>;
  onFileSelect: (path: string) => void;
  onFileHover: (path: string | null) => void;
  className: string;
};

const moduleKinds = { 'es-module': 'ES module', commonjs: 'CommonJS', script: 'Script' };
const tabs: Tab[] = ['structure', 'explanation'];

export function DetailPane({
  repository, result, details, selection, folders, mapHover, owners,
  onFileSelect, onFileHover, className,
}: Props) {
  const [tab, setTab] = useState<Tab>('structure');
  const id = useId();
  const file = selection === null ? undefined : details.files.get(selection);
  const folder = selection === null ? undefined : folders.get(selection);
  const selected = Boolean(file || folder);
  const imports = file ? [...(details.imports.get(file.path) ?? [])].sort() : [];
  const importedBy = file ? [...(details.importedBy.get(file.path) ?? [])].sort() : [];
  const folderKinds = new Map<string, number>();
  const [copied, setCopied] = useState(false);
  for (const member of folder?.files ?? []) {
    const kind = member.role ?? member.extension;
    folderKinds.set(kind, (folderKinds.get(kind) ?? 0) + 1);
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>) {
    const next = event.key === 'Home' ? 'structure' : event.key === 'End' ? 'explanation'
      : event.key === 'ArrowLeft' || event.key === 'ArrowRight'
        ? tab === 'structure' ? 'explanation' : 'structure'
        : null;
    if (!next) return;
    event.preventDefault();
    setTab(next);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();
  }

  function pathButton(path: string) {
    const highlighted = mapHover === path ||
      (mapHover !== null && !details.files.has(mapHover) && owners.get(path) === mapHover);
    return (
      <button
        type="button"
        className={styles.path}
        data-map-hover={highlighted}
        onClick={() => onFileSelect(path)}
        onMouseEnter={() => onFileHover(path)}
        onMouseLeave={() => onFileHover(null)}
        onFocus={() => onFileHover(path)}
        onBlur={() => onFileHover(null)}
      >
        {path}
      </button>
    );
  }

  function pathList(title: string, paths: { path: string; count?: number }[], empty: string) {
    return (
      <section className={styles.section}>
        <h3>{title}</h3>
        {paths.length === 0 ? <p className={styles.muted}>{empty}</p> : (
          <ul className={styles.paths}>
            {paths.map(({ path, count }) => (
              <li key={path}>{pathButton(path)}{count !== undefined && <span>{count}</span>}</li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  async function copySelection() {
    const path = file?.path ?? folder?.id;
    if (!path) return;
    await navigator.clipboard.writeText(path);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const explanation = file
    ? `${file.path} is a ${file.role ?? file.extension} file with ${file.lines} lines. It imports ${imports.length} repository file${imports.length === 1 ? '' : 's'} and is imported by ${importedBy.length} repository file${importedBy.length === 1 ? '' : 's'}.`
    : folder
      ? `${folder.id} contains ${folder.files.length} files. It has ${folder.fanIn} incoming folder connection${folder.fanIn === 1 ? '' : 's'} and ${folder.fanOut} outgoing folder connection${folder.fanOut === 1 ? '' : 's'}.`
      : `${repository} contains ${result.files.length} parsed files and ${result.edges.length} resolved imports.`;

  let structure: ReactNode;
  if (file) {
    structure = <>
      <Facts rows={[
        ['Kind', file.role ? `${file.role} / ${moduleKinds[file.moduleKind]}` : moduleKinds[file.moduleKind]],
        ['Folder', file.folder],
        ['Extension', file.extension],
        ['Lines', file.lines],
        ['Hash', file.hash.slice(0, 12)],
        ['Fan in', file.fanIn],
        ['Fan out', file.fanOut],
        ['Imports', imports.length],
        ['Imported by', importedBy.length],
      ]} />
      {pathList('Imports', imports.map(path => ({ path })), 'No imports within the repository.')}
      {pathList('Imported by', importedBy.map(path => ({ path })), 'No files import this file.')}
    </>;
  } else if (folder) {
    structure = <>
      <Facts rows={[
        ['Files', folder.files.length],
        ['Fan in', folder.fanIn],
        ['Fan out', folder.fanOut],
      ]} />
      <section className={styles.section}>
        <h3>File kinds</h3>
        <Facts rows={[...folderKinds].sort(([a], [b]) => a.localeCompare(b))} />
      </section>
      {pathList(`All files (${folder.files.length})`, folder.files.map(member => ({ path: member.path })).sort((a, b) => a.path.localeCompare(b.path)), 'This folder is empty.')}
    </>;
  } else {
    structure = <>
      <Facts rows={[
        ['Framework', result.adapter === 'none' ? 'None detected' : result.adapter],
        ['Files', result.files.length],
        ['Imports seen', result.coverage.importsSeen],
        ['Routes', 'Not analyzed'],
        ['Unclassified files', details.unclassified],
      ]} />
      {pathList('Most imported files', details.mostImported.map(({ path, incoming }) => ({ path, count: incoming })), 'No internal imports found.')}
      {pathList(`Reading starts (${details.readingStarts.length})`, details.readingStarts.map(({ path }) => ({ path })), 'Every file is imported.')}
    </>;
  }

  return <aside aria-label="Details" className={`${className} ${styles.pane}`}>
    <header className={styles.header}>
      <p>{file ? 'File' : folder ? 'Folder' : 'Repository'}</p>
      <h2 data-map-hover={Boolean(mapHover && (mapHover === selection || (file && mapHover === owners.get(file.path))))}>
        {file ? pathButton(file.path) : folder ? folder.id : repository}
      </h2>
      {selected && <button type="button" className={styles.copyButton} onClick={() => void copySelection()}>
        {copied ? 'Copied' : 'Copy path'}
      </button>}
      {selected && <div role="tablist" aria-label="Detail view" className={styles.tabs}>
        {tabs.map(name => <button
          key={name}
          type="button"
          role="tab"
          id={`${id}-${name}`}
          aria-controls={`${id}-panel-${name}`}
          aria-selected={tab === name}
          data-tab={name}
          tabIndex={tab === name ? 0 : -1}
          onKeyDown={navigateTabs}
          onClick={() => setTab(name)}
        >{name === 'structure' ? 'Structure' : 'Explanation'}</button>)}
      </div>}
    </header>
    <div className={styles.body} key={selection ?? 'repository'}>
      {selected ? <>
        <div role="tabpanel" id={`${id}-panel-structure`} aria-labelledby={`${id}-structure`} hidden={tab !== 'structure'} tabIndex={0}>
          {structure}
        </div>
        <div role="tabpanel" id={`${id}-panel-explanation`} aria-labelledby={`${id}-explanation`} hidden={tab !== 'explanation'} tabIndex={0}>
          <p className={styles.explanation}>{explanation}</p>
        </div>
      </> : structure}
    </div>
  </aside>;
}

function Facts({ rows }: { rows: [string, string | number][] }) {
  return <dl className={styles.facts}>
    {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl>;
}
