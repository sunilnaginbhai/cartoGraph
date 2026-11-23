"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

import styles from "./canvas-shell.module.css";
import { DependencyMap } from './dependency-map';
import { ThemeControl } from './theme-control';
import type { ParserResult } from '../../parser/types';

type CanvasShellProps = {
  analysisId: number;
  repository: string;
  result: ParserResult;
  rerunAction: (formData: FormData) => void | Promise<void>;
  showThemeControl?: boolean;
};

export function CanvasShell({ analysisId, repository, result, rerunAction, showThemeControl = true }: CanvasShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const hasPersistedLeft = useRef(false);
  const hasPersistedRight = useRef(false);
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(260);
  const [category, setCategory] = useState<string | null>(null);
  const extensions = [...new Set(result.files.map(file => file.extension))].sort();
  const internalImports = result.coverage.importsResolved + result.coverage.importsExcluded + result.coverage.importsUnresolved;
  const fileCoverage = result.coverage.filesFound === 0 ? 100 : result.coverage.filesParsed / result.coverage.filesFound * 100;
  const importCoverage = internalImports === 0 ? 100 : result.coverage.importsResolved / internalImports * 100;
  const coverage = Math.round(Math.min(fileCoverage, importCoverage));

  function startResize(side: "left" | "right", event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startLeft = leftWidth;
    const startRight = rightWidth;
    const shell = shellRef.current;
    if (!shell) return;
    shell.dataset.resizing = "true";

    const move = (pointerEvent: PointerEvent) => {
      const rect = shell.getBoundingClientRect();
      const minimum = 180;
      const maximum = Math.max(minimum, rect.width * 0.38);
      if (side === "left") {
        setLeftWidth(Math.round(Math.min(maximum, Math.max(minimum, startLeft + pointerEvent.clientX - startX))));
      } else {
        setRightWidth(Math.round(Math.min(maximum, Math.max(minimum, startRight - (pointerEvent.clientX - startX)))));
      }
    };
    const stop = () => {
      shell.dataset.resizing = "false";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function resizeWithKeyboard(side: "left" | "right", event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 24 : -24;
    if (side === "left") {
      setLeftWidth(width => Math.round(Math.min(520, Math.max(180, width + direction))));
    } else {
      setRightWidth(width => Math.round(Math.min(520, Math.max(180, width - direction))));
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedLeft = Number(localStorage.getItem("cartograph-left-pane"));
    const savedRight = Number(localStorage.getItem("cartograph-right-pane"));
    const frame = window.requestAnimationFrame(() => {
      if (savedLeft >= 180 && savedLeft <= 520) setLeftWidth(savedLeft);
      if (savedRight >= 180 && savedRight <= 520) setRightWidth(savedRight);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasPersistedLeft.current) {
      hasPersistedLeft.current = true;
      return;
    }
    localStorage.setItem("cartograph-left-pane", String(leftWidth));
  }, [leftWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasPersistedRight.current) {
      hasPersistedRight.current = true;
      return;
    }
    localStorage.setItem("cartograph-right-pane", String(rightWidth));
  }, [rightWidth]);

  return (
    <div
      ref={shellRef}
      className={styles.shell}
      style={{ "--left-pane": `${leftWidth}px`, "--right-pane": `${rightWidth}px` } as CSSProperties}
    >
      <aside aria-label="Categories" className={styles.rail}>
        <h1>{repository}</h1>
        {showThemeControl && <ThemeControl />}
        <p>{result.files.length} files · {result.edges.length} imports</p>
        <details className={styles.coverage} open={coverage < 95}>
          <summary><span>Graph coverage</span><strong>{coverage}%</strong></summary>
          <p>{coverage < 95 ? "This graph is partial." : "The parsed graph has high coverage."} {result.coverage.filesSkipped} files skipped and {result.coverage.importsUnresolved} imports unresolved.</p>
        </details>
        <form action={rerunAction} className={styles.rerunForm}>
          <input type="hidden" name="analysisId" value={analysisId} />
          <button type="submit">Re-run at latest commit</button>
        </form>
        <h2>Extensions</h2>
        {extensions.map((extension, index) => <button type="button" className={styles.category} data-active={category === extension} aria-pressed={category === extension} key={extension} onClick={() => setCategory(current => current === extension ? null : extension)}><span data-swatch={index % 4} />{extension}<small>{result.files.filter(file => file.extension === extension).length}</small></button>)}
        <p>{result.coverage.filesSkipped} skipped · {result.coverage.importsUnresolved} unresolved</p>
      </aside>
      <div
        aria-label="Resize categories panel"
        className={`${styles.resizer} ${styles.leftResizer}`}
        role="separator"
        tabIndex={0}
        onPointerDown={event => startResize("left", event)}
        onKeyDown={event => resizeWithKeyboard("left", event)}
      />
      <DependencyMap result={result} repository={repository} category={category} />
      <div
        aria-label="Resize details panel"
        className={`${styles.resizer} ${styles.rightResizer}`}
        role="separator"
        tabIndex={0}
        onPointerDown={event => startResize("right", event)}
        onKeyDown={event => resizeWithKeyboard("right", event)}
      />
    </div>
  );
}
