import { Suspense } from "react";
import { createServerSupabaseClient } from "../../lib/supabase/server";

type Analysis = {
  id: number;
  name: string;
  status: "queued" | "parsing" | "complete" | "failed";
  commit_sha: string | null;
  created_at: string;
  finished_at: string | null;
};

export default function WorkspacePage() {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <Workspace />
    </Suspense>
  );
}

async function Workspace() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("id, name, status, commit_sha, created_at, finished_at")
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<Analysis[]>();

  if (error) {
    throw new Error(`Could not load analyses: ${error.message}`);
  }

  return (
    <main className="workspace-main">
      <section aria-labelledby="workspace-heading" className="analysis-panel">
        <div className="workspace-panel-heading">
          <h1 id="workspace-heading">Team analyses</h1>
          <span className="analysis-count">
            {data.length} {data.length === 1 ? "analysis" : "analyses"}
          </span>
        </div>
        {data.length === 0 ? <EmptyAnalyses /> : <AnalysisList analyses={data} />}
      </section>
    </main>
  );
}

function AnalysisList({ analyses }: { analyses: Analysis[] }) {
  return (
    <div className="analysis-table-wrap">
      <table className="analysis-table">
        <thead>
          <tr>
            <th scope="col">Repository</th>
            <th scope="col">State</th>
            <th scope="col">Commit</th>
            <th scope="col">Started</th>
            <th scope="col">Finished</th>
          </tr>
        </thead>
        <tbody>
          {analyses.map((analysis) => (
            <tr key={analysis.id}>
              <td className="analysis-repository">{analysis.name}</td>
              <td>
                <span className="analysis-status" data-status={analysis.status}>
                  {analysis.status}
                </span>
              </td>
              <td className="analysis-commit">{analysis.commit_sha ?? "—"}</td>
              <td>
                <time dateTime={analysis.created_at}>
                  {formatRelativeTime(analysis.created_at)}
                </time>
              </td>
              <td>
                {analysis.finished_at ? (
                  <time dateTime={analysis.finished_at}>
                    {formatRelativeTime(analysis.finished_at)}
                  </time>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatRelativeTime(value: string) {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60_000),
  );

  if (elapsedMinutes < 1) return "now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

function EmptyAnalyses() {
  return (
    <div className="analysis-empty">
      <p>No analyses yet</p>
      <span>This team has not mapped a repository.</span>
    </div>
  );
}

function WorkspaceLoading() {
  return (
    <main className="workspace-main">
      <p className="workspace-loading" role="status">
        Loading workspace…
      </p>
    </main>
  );
}
