"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

import styles from "./canvas-shell.module.css";
import { DependencyMap } from './dependency-map';
import raw from '../preview/analysis.json';
import { isParserResult } from '../../parser/validate';
import { ThemeControl } from './theme-control';

function validatedResult() {
  if (!isParserResult(raw)) throw new Error('Preview fixture does not match the parser contract.');
  return raw;
}
const result = validatedResult();
const repository = 'excalidraw / excalidraw';

export function CanvasShell() {
  const shellRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window === "undefined") return 260;
    const savedLeft = Number(localStorage.getItem("cartograph-left-pane"));
    return savedLeft >= 180 && savedLeft <= 520 ? savedLeft : 260;
  });
  const [rightWidth, setRightWidth] = useState(() => {
    if (typeof window === "undefined") return 260;
    const savedRight = Number(localStorage.getItem("cartograph-right-pane"));
    return savedRight >= 180 && savedRight <= 520 ? savedRight : 260;
  });

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
    localStorage.setItem("cartograph-left-pane", String(leftWidth));
  }, [leftWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
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
        <ThemeControl />
        <p>{result.files.length} files · {result.edges.length} imports</p>
        <h2>Extensions</h2>
        {[...new Set(result.files.map(f=>f.extension))].sort().map((extension,index)=><div className={styles.category} key={extension}><span style={{background:['#8ba9cc','#ba9ccd','#87b6a1','#c4aa80'][index%4]}} />{extension}<small>{result.files.filter(f=>f.extension===extension).length}</small></div>)}
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
      <DependencyMap result={result} repository={repository} />
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
