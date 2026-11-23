"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";

export type DashboardAnalysis = { id: number; name: string; status: "queued" | "parsing" | "complete" | "failed"; stage: string; stage_message: string; commit_sha: string | null; created_at: string; updated_at: string; finished_at: string | null; is_stale: boolean };

export function AnalysisList({ analyses: initial }: { analyses: DashboardAnalysis[] }) {
  const { getToken } = useAuth();
  const [analyses, setAnalyses] = useState(initial);
  const supabase = useMemo(() => createBrowserSupabaseClient(() => getToken()), [getToken]);

  useEffect(() => {
    let cancelled = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];
    void getToken().then(token => {
      if (!token || cancelled) return;
      supabase.realtime.setAuth(token);
      for (const analysis of initial.filter(item => item.status === "queued" || item.status === "parsing")) {
        const channel = supabase.channel(`analysis:${analysis.id}`, { config: { private: true } })
          .on("broadcast", { event: "progress" }, event => {
            const payload = event.payload as { stage?: unknown; message?: unknown };
            if (typeof payload.stage !== "string" || typeof payload.message !== "string") return;
            setAnalyses(current => current.map(item => item.id === analysis.id ? {
              ...item,
              stage: payload.stage as string,
              stage_message: payload.message as string,
              status: payload.stage === "complete" ? "complete" : payload.stage === "failed" ? "failed" : "parsing",
              is_stale: false,
            } : item));
          }).subscribe();
        channels.push(channel);
      }
    });
    return () => { cancelled = true; for (const channel of channels) void supabase.removeChannel(channel); };
  }, [getToken, initial, supabase]);

  return <div className="analysis-table-wrap"><table className="analysis-table"><thead><tr><th scope="col">Repository</th><th scope="col">State</th><th scope="col">Commit</th><th scope="col">Started</th><th scope="col">Finished</th></tr></thead><tbody>{analyses.map(analysis => {
    const href = analysis.status === "complete" ? `/workspace/${analysis.id}` : `/workspace/${analysis.id}/progress`;
    const state = analysis.is_stale ? "stale" : analysis.status;
    return <tr key={analysis.id}><td className="analysis-repository"><Link href={href}>{analysis.name}</Link><small>{analysis.stage_message}</small></td><td><span className="analysis-status" data-status={state}>{state}</span></td><td className="analysis-commit">{analysis.commit_sha?.slice(0, 8) ?? "—"}</td><td><time dateTime={analysis.created_at}>{formatDate(analysis.created_at)}</time></td><td>{analysis.finished_at ? <time dateTime={analysis.finished_at}>{formatDate(analysis.finished_at)}</time> : "—"}</td></tr>;
  })}</tbody></table></div>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
