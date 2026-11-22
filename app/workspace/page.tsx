import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { createServerSupabaseClient } from "../../lib/supabase/server";

export default function WorkspacePage() {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <Workspace />
    </Suspense>
  );
}

async function Workspace() {
  const { orgId } = await auth();

  // Construct this here so missing Supabase configuration fails on the first
  // protected request, before later phases add database queries.
  createServerSupabaseClient();

  return (
    <main className="workspace-main">
      <section aria-labelledby="workspace-heading" className="workspace-panel">
        <div className="workspace-panel-heading">
          <p className="workspace-kicker">Active organization</p>
          <span className="workspace-status">Ready</span>
        </div>
        <h1 id="workspace-heading">Your map desk is ready.</h1>
        <p>
          This workspace is scoped to <code>{orgId}</code>. Repository maps
          appear here once you add a public repository.
        </p>
        <p className="workspace-footnote">
          The first map starts with a repository URL, not an uploaded codebase.
        </p>
      </section>
    </main>
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
