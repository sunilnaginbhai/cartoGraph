import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { CanvasShell } from "../../components/canvas-shell";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import type { CoverageReport, DependencyEdge, ParsedFile, ParserResult } from "../../../parser/types";
import { rerunAnalysis } from "../actions";

type StoredAnalysis = { id: number; name: string; status: string; commit_sha: string | null; coverage: CoverageReport | null; created_at: string };
type StoredFile = { id: number; path: string; folder: string; extension: string; module_kind: ParsedFile["moduleKind"]; role: string | null; lines: number; hash: string; fan_in: number; fan_out: number };
type StoredEdge = { source_file_id: number; target_file_id: number; kind: DependencyEdge["kind"]; specifier: string };

export default function AnalysisPage(props: PageProps<"/workspace/[analysisId]">) {
  return <Suspense fallback={<main className="workspace-main"><p className="workspace-loading" role="status">Loading stored graph…</p></main>}><StoredAnalysisPage {...props} /></Suspense>;
}

async function StoredAnalysisPage({ params }: PageProps<"/workspace/[analysisId]">) {
  const { analysisId } = await params; const id = Number(analysisId); if (!Number.isInteger(id)) notFound();
  const supabase = await createServerSupabaseClient();
  const [analysisResult, filesResult, edgesResult] = await Promise.all([
    supabase.from("analyses").select("id, name, status, commit_sha, coverage, created_at").eq("id", id).single<StoredAnalysis>(),
    supabase.from("files").select("id, path, folder, extension, module_kind, role, lines, hash, fan_in, fan_out").eq("analysis_id", id).limit(10_000).returns<StoredFile[]>(),
    supabase.from("edges").select("source_file_id, target_file_id, kind, specifier").eq("analysis_id", id).limit(25_000).returns<StoredEdge[]>(),
  ]);
  if (analysisResult.error) notFound();
  if (analysisResult.data.status !== "complete") redirect(`/workspace/${id}/progress`);
  if (filesResult.error || edgesResult.error || !analysisResult.data.coverage) throw new Error("Could not load the stored dependency graph.");
  const paths = new Map(filesResult.data.map(file => [file.id, file.path]));
  const files: ParsedFile[] = filesResult.data.map(file => ({ path: file.path, folder: file.folder, extension: file.extension, moduleKind: file.module_kind, role: file.role, lines: file.lines, hash: file.hash, fanIn: file.fan_in, fanOut: file.fan_out }));
  const edges: DependencyEdge[] = edgesResult.data.map(edge => {
    const source = paths.get(edge.source_file_id); const target = paths.get(edge.target_file_id);
    if (!source || !target) throw new Error("A stored import refers to a missing file.");
    return { source, target, kind: edge.kind, specifier: edge.specifier };
  });
  const result: ParserResult = { version: 1, root: analysisResult.data.name, generatedAt: analysisResult.data.created_at, adapter: "stored", files, edges, coverage: analysisResult.data.coverage };
  return <CanvasShell analysisId={id} repository={analysisResult.data.name} result={result} rerunAction={rerunAnalysis} />;
}
