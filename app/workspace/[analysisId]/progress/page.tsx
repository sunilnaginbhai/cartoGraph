import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { ProgressView } from "./progress-view";
export default function ProgressPage(props: PageProps<"/workspace/[analysisId]/progress">) {
  return <Suspense fallback={<main className="progress-main"><p className="workspace-loading" role="status">Loading analysis progress…</p></main>}><AnalysisProgressPage {...props} /></Suspense>;
}

async function AnalysisProgressPage({ params }: PageProps<"/workspace/[analysisId]/progress">) {
  const { analysisId } = await params; const id = Number(analysisId); if (!Number.isInteger(id)) notFound();
  const supabase = await createServerSupabaseClient(); const { data, error } = await supabase.from("analyses").select("id, name, status, stage, stage_message").eq("id", id).single<{ id: number; name: string; status: string; stage: string; stage_message: string }>();
  if (error) notFound(); if (data.status === "complete") redirect(`/workspace/${id}`);
  return <ProgressView analysisId={id} repository={data.name} initial={{ stage: data.stage, message: data.stage_message }} />;
}
