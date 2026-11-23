"use server";

import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import { redirect } from "next/navigation";

import { runAnalysis } from "../../lib/analysis/pipeline";
import { parsePublicRepositoryUrl } from "../../lib/analysis/repository";
import { createAdminSupabaseClient } from "../../lib/supabase/admin";

export async function createAnalysis(formData: FormData) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("Select an organization before analysing a repository.");
  const repository = parsePublicRepositoryUrl(String(formData.get("repositoryUrl") ?? ""));
  const supabase = createAdminSupabaseClient();

  const { error: organizationError } = await supabase.from("organizations").upsert({ id: orgId });
  if (organizationError) throw new Error(`Could not prepare the organization: ${organizationError.message}`);

  const { data: project, error: projectError } = await supabase.from("projects").upsert({
    organization_id: orgId,
    name: repository.displayName,
    repository_url: repository.url,
  }, { onConflict: "organization_id,repository_url" }).select("id").single<{ id: number }>();
  if (projectError) throw new Error(`Could not prepare the repository: ${projectError.message}`);

  const { data: existing } = await supabase.from("analyses")
    .select("id, status").eq("project_id", project.id).maybeSingle<{ id: number; status: string }>();
  if (existing) redirect(existing.status === "complete" ? `/workspace/${existing.id}` : `/workspace/${existing.id}/progress`);

  const { data: analysis, error: analysisError } = await supabase.from("analyses").insert({
    organization_id: orgId,
    project_id: project.id,
    name: repository.displayName,
    status: "queued",
    stage: "fetching",
    stage_message: "Waiting to fetch the repository",
  }).select("id").single<{ id: number }>();
  if (analysisError?.code === "23505") {
    const { data: concurrent } = await supabase.from("analyses").select("id, status").eq("project_id", project.id).single<{ id: number; status: string }>();
    if (concurrent) redirect(concurrent.status === "complete" ? `/workspace/${concurrent.id}` : `/workspace/${concurrent.id}/progress`);
  }
  if (analysisError || !analysis) throw new Error(`Could not create the analysis: ${analysisError?.message ?? "No row was returned."}`);

  after(() => runAnalysis(analysis.id, repository));
  redirect(`/workspace/${analysis.id}/progress`);
}

export async function rerunAnalysis(formData: FormData) {
  const id = Number(formData.get("analysisId"));
  if (!Number.isInteger(id) || id < 1) throw new Error("The analysis id is invalid.");
  const { orgId } = await auth();
  if (!orgId) throw new Error("Select an organization before re-running an analysis.");
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.from("analyses")
    .select("id, projects!inner(repository_url)")
    .eq("id", id).eq("organization_id", orgId).single<{ id: number; projects: { repository_url: string } }>();
  if (error) throw new Error("That analysis is not available in this organization.");
  const repository = parsePublicRepositoryUrl(data.projects.repository_url);
  const { error: updateError } = await supabase.from("analyses").update({
    status: "queued",
    stage: "fetching",
    stage_message: "Waiting to fetch the repository",
    failed_stage: null,
    error_message: null,
    finished_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("organization_id", orgId);
  if (updateError) throw new Error(`Could not restart the analysis: ${updateError.message}`);
  after(() => runAnalysis(id, repository));
  redirect(`/workspace/${id}/progress`);
}
