import Link from "next/link";
import { ThemeControl } from "./theme-control";

export function CanvasShell() {
  return (
    <div className="canvas-shell">
      <header className="canvas-toolbar">
        <div className="canvas-toolbar-context">
          <Link className="product-mark" href="/">
            Cartograph
          </Link>
          <span aria-hidden="true">/</span>
          <span>Preview</span>
        </div>
        <ThemeControl />
      </header>

      <div className="canvas-columns">
        <aside aria-labelledby="category-rail-heading" className="canvas-rail">
          <header className="canvas-pane-header">
            <h2 id="category-rail-heading">Files</h2>
          </header>
          <p className="canvas-pane-empty">Categories will appear here.</p>
        </aside>

        <main aria-labelledby="canvas-heading" className="canvas-stage">
          <header className="canvas-pane-header">
            <h1 id="canvas-heading">Map</h1>
          </header>
          <div aria-label="Empty map canvas" className="canvas-stage-surface" />
        </main>

        <aside aria-labelledby="detail-pane-heading" className="canvas-detail">
          <header className="canvas-pane-header">
            <h2 id="detail-pane-heading">Details</h2>
          </header>
        </aside>
      </div>
    </div>
  );
}
