import styles from "./canvas-shell.module.css";
import { DependencyMap } from './dependency-map';
import raw from '../preview/analysis.json';
import { isParserResult } from '../../parser/result';

function validatedResult() {
  if (!isParserResult(raw)) throw new Error('Preview fixture does not match the parser contract.');
  return raw;
}
const result = validatedResult();

export function CanvasShell() {
  return (
    <div className={styles.shell}>
      <aside aria-label="Categories" className={styles.rail}>
        <h1>excalidraw / excalidraw</h1>
        <p>{result.files.length} files · {result.edges.length} imports</p>
        <h2>Extensions</h2>
        {[...new Set(result.files.map(f=>f.extension))].sort().map((extension,index)=><div className={styles.category} key={extension}><span style={{background:['#8ba9cc','#ba9ccd','#87b6a1','#c4aa80'][index%4]}} />{extension}<small>{result.files.filter(f=>f.extension===extension).length}</small></div>)}
        <p>{result.coverage.filesSkipped} skipped · {result.coverage.importsUnresolved} unresolved</p>
      </aside>
      <main aria-label="Map" className={styles.stage}><DependencyMap result={result}/></main>
      <aside aria-label="Details" className={styles.detail} />
    </div>
  );
}
