import { Suspense } from "react";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { createAnalysis } from "./actions";
import { AnalysisList, type DashboardAnalysis } from "./analysis-list";

export const maxDuration = 300;

export default function WorkspacePage() { return <Suspense fallback={<WorkspaceLoading />}><Workspace /></Suspense>; }

async function Workspace() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("analysis_dashboard").select("id, name, status, stage, stage_message, commit_sha, created_at, updated_at, finished_at, is_stale").order("created_at", { ascending: false }).limit(50).returns<DashboardAnalysis[]>();
  if (error) throw new Error(`Could not load analyses: ${error.message}`);
  return <main className="workspace-main">
    <section aria-labelledby="new-analysis-heading" className="repository-entry">
      <div><h1 id="new-analysis-heading">Map a public repository</h1><p>Paste its GitHub URL. Cartograph fetches the current commit and maps only imports it can resolve.</p></div>
      <form action={createAnalysis} className="repository-form">
        <label htmlFor="repository-url">Repository URL</label>
        <div><input id="repository-url" name="repositoryUrl" type="url" required placeholder="https://github.com/owner/repository" /><button className="button button-primary" type="submit">Analyse repository</button></div>
        <span>Public TypeScript and JavaScript repositories only. No GitHub token is requested or stored.</span>
      </form>
    </section>
    <section aria-labelledby="workspace-heading" className="analysis-panel">
      <div className="workspace-panel-heading"><h2 id="workspace-heading">Team analyses</h2><span className="analysis-count">{data.length} {data.length === 1 ? "analysis" : "analyses"}</span></div>
      {data.length === 0 ? <EmptyAnalyses /> : <AnalysisList analyses={data} />}
    </section>
  </main>;
}

function EmptyAnalyses() { return <div className="analysis-empty"><p>No analyses yet</p><span>Paste a public repository URL above to create this team&apos;s first map.</span></div>; }
function WorkspaceLoading() { return <main className="workspace-main"><p className="workspace-loading" role="status">Loading workspace…</p></main>; }
