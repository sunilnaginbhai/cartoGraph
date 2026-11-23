"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "../../../../lib/supabase/browser";

const stages = ["fetching", "selecting", "parsing", "storing", "complete"] as const;
type Progress = { stage: string; message: string };

export function ProgressView({ analysisId, repository, initial }: { analysisId: number; repository: string; initial: Progress }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState(initial);
  const [connection, setConnection] = useState("Connecting to live progress");
  const supabase = useMemo(() => createBrowserSupabaseClient(() => getToken()), [getToken]);

  useEffect(() => {
    if (progress.stage === "complete") router.replace(`/workspace/${analysisId}`);
  }, [analysisId, progress.stage, router]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    void getToken().then(token => {
      if (!token || cancelled) { setConnection("Live progress unavailable"); return; }
      supabase.realtime.setAuth(token);
      channel = supabase.channel(`analysis:${analysisId}`, { config: { private: true } })
        .on("broadcast", { event: "progress" }, event => {
          const payload = event.payload as Partial<Progress>;
          if (typeof payload.stage === "string" && typeof payload.message === "string") setProgress({ stage: payload.stage, message: payload.message });
        })
        .subscribe(status => {
          if (status === "SUBSCRIBED") setConnection("Live progress connected");
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnection("Live progress disconnected");
        });
    });
    return () => { cancelled = true; if (channel) void supabase.removeChannel(channel); };
  }, [analysisId, getToken, supabase]);

  const currentIndex = progress.stage === "failed" ? -1 : stages.indexOf(progress.stage as typeof stages[number]);
  return <main className="progress-main">
    <section className="progress-panel" aria-labelledby="progress-heading">
      <div className="progress-heading"><div><p>Repository analysis</p><h1 id="progress-heading">{repository}</h1></div><span>{connection}</span></div>
      <ol className="stage-list">{stages.slice(0, -1).map((stage, index) => <li key={stage} data-state={progress.stage === "failed" ? "waiting" : index < currentIndex ? "done" : index === currentIndex ? "active" : "waiting"}>
        <span aria-hidden="true">{index < currentIndex ? "✓" : index + 1}</span><div><strong>{stageLabel(stage)}</strong><small>{index === currentIndex ? progress.message : stageDescription(stage)}</small></div>
      </li>)}</ol>
      {progress.stage === "failed" ? <div className="progress-error" role="alert"><strong>Analysis failed</strong><p>{progress.message}</p><Link href="/workspace">Return to workspace</Link></div> : <p className="progress-note" role="status" aria-live="polite">{progress.message}</p>}
    </section>
  </main>;
}

function stageLabel(stage: string) { return ({ fetching: "Fetch archive", selecting: "Select source", parsing: "Parse imports", storing: "Store graph" } as Record<string, string>)[stage] ?? stage; }
function stageDescription(stage: string) { return ({ fetching: "Download the public repository at one commit", selecting: "Locate source files inside the archive", parsing: "Resolve real files and imports", storing: "Write the graph and coverage report" } as Record<string, string>)[stage] ?? ""; }
