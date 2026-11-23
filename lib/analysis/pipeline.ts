import "server-only";

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { parseRepository } from "../../parser/parser";
import type { ParserResult } from "../../parser/types";
import { createAdminSupabaseClient } from "../supabase/admin";
import type { PublicRepository } from "./repository";

type Stage = "fetching" | "selecting" | "parsing" | "storing";

export async function runAnalysis(analysisId: number, repository: PublicRepository) {
  const supabase = createAdminSupabaseClient();
  let stage: Stage = "fetching";
  let workingDirectory: string | null = null;

  try {
    await setProgress(analysisId, stage, "Fetching the public repository archive");
    const metadata = await githubJson<{ default_branch: string }>(
      `https://api.github.com/repos/${repository.owner}/${repository.name}`,
    );
    const branch = await githubJson<{ commit: { sha: string } }>(
      `https://api.github.com/repos/${repository.owner}/${repository.name}/branches/${encodeURIComponent(metadata.default_branch)}`,
    );
    const commitSha = branch.commit.sha;
    const archiveResponse = await fetch(
      `https://api.github.com/repos/${repository.owner}/${repository.name}/tarball/${commitSha}`,
      { headers: githubHeaders(), signal: AbortSignal.timeout(60_000) },
    );
    if (!archiveResponse.ok) throw new Error(githubFailure(archiveResponse.status));

    workingDirectory = await mkdtemp(path.join(tmpdir(), "cartograph-"));
    const archivePath = path.join(workingDirectory, "repository.tar.gz");
    const extractPath = path.join(workingDirectory, "source");
    await writeFile(archivePath, Buffer.from(await archiveResponse.arrayBuffer()));
    await runTar(archivePath, extractPath);

    stage = "selecting";
    await setProgress(analysisId, stage, "Selecting source files from the archive");
    const entries = await readdir(extractPath, { withFileTypes: true });
    const roots = entries.filter(entry => entry.isDirectory());
    if (roots.length !== 1) throw new Error("The repository archive did not contain one source root.");
    const repositoryRoot = path.join(extractPath, roots[0].name);

    stage = "parsing";
    await setProgress(analysisId, stage, "Resolving files and imports from source");
    const result = await parseRepository(repositoryRoot);

    stage = "storing";
    await setProgress(analysisId, stage, "Storing the parsed graph");
    await storeResult(analysisId, result);
    const { error } = await supabase.from("analyses").update({
      status: "complete",
      stage: "complete",
      stage_message: "Analysis complete",
      commit_sha: commitSha,
      coverage: result.coverage,
      failed_stage: null,
      error_message: null,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", analysisId);
    if (error) throw new Error(`Could not complete the analysis: ${error.message}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The analysis failed for an unknown reason.";
    await supabase.from("analyses").update({
      status: "failed",
      stage: "failed",
      stage_message: message,
      failed_stage: stage,
      error_message: message,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", analysisId);
  } finally {
    if (workingDirectory) await rm(workingDirectory, { recursive: true, force: true });
  }
}

async function setProgress(analysisId: number, stage: Stage, message: string) {
  const { error } = await createAdminSupabaseClient().from("analyses").update({
    status: "parsing",
    stage,
    stage_message: message,
    updated_at: new Date().toISOString(),
  }).eq("id", analysisId);
  if (error) throw new Error(`Could not record ${stage} progress: ${error.message}`);
}

async function storeResult(analysisId: number, result: ParserResult) {
  const supabase = createAdminSupabaseClient();
  const { data: analysis, error: analysisError } = await supabase
    .from("analyses").select("organization_id").eq("id", analysisId).single<{ organization_id: string }>();
  if (analysisError) throw new Error(`Could not load analysis ownership: ${analysisError.message}`);

  const { error: deleteError } = await supabase.from("files").delete().eq("analysis_id", analysisId);
  if (deleteError) throw new Error(`Could not replace stored files: ${deleteError.message}`);

  const fileIds = new Map<string, number>();
  for (const batch of batches(result.files, 500)) {
    const { data, error } = await supabase.from("files").insert(batch.map(file => ({
      organization_id: analysis.organization_id,
      analysis_id: analysisId,
      path: file.path,
      folder: file.folder,
      extension: file.extension,
      module_kind: file.moduleKind,
      role: file.role,
      lines: file.lines,
      hash: file.hash,
      fan_in: file.fanIn,
      fan_out: file.fanOut,
    }))).select("id, path").returns<{ id: number; path: string }[]>();
    if (error) throw new Error(`Could not store parsed files: ${error.message}`);
    for (const file of data) fileIds.set(file.path, file.id);
  }

  for (const batch of batches(result.edges, 500)) {
    const rows = batch.map(edge => {
      const sourceFileId = fileIds.get(edge.source);
      const targetFileId = fileIds.get(edge.target);
      if (!sourceFileId || !targetFileId) throw new Error("A parsed edge referred to a file that was not stored.");
      return {
        organization_id: analysis.organization_id,
        analysis_id: analysisId,
        source_file_id: sourceFileId,
        target_file_id: targetFileId,
        kind: edge.kind,
        specifier: edge.specifier,
      };
    });
    const { error } = await supabase.from("edges").insert(rows);
    if (error) throw new Error(`Could not store parsed imports: ${error.message}`);
  }
}

function batches<T>(values: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}

async function githubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: githubHeaders(), signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(githubFailure(response.status));
  return response.json() as Promise<T>;
}

function githubHeaders() {
  return { Accept: "application/vnd.github+json", "User-Agent": "Cartograph" };
}

function githubFailure(status: number) {
  if (status === 404) return "GitHub could not find that public repository.";
  if (status === 403) return "GitHub refused the archive request. Try again after its public rate limit resets.";
  return `GitHub returned ${status} while fetching the repository.`;
}

async function runTar(archivePath: string, extractPath: string) {
  await mkdir(extractPath, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const child = spawn("tar", ["-xzf", archivePath, "-C", extractPath], { windowsHide: true });
    let errorOutput = "";
    child.stderr.on("data", chunk => { errorOutput += String(chunk); });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(errorOutput.trim() || "Could not unpack the repository archive.")));
  });
}
