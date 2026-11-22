alter table public.analyses
  add column commit_sha text,
  add column finished_at timestamptz;

alter table public.analyses
  add constraint analyses_commit_sha_not_blank
  check (commit_sha is null or length(trim(commit_sha)) > 0),
  add constraint analyses_finished_after_started
  check (finished_at is null or finished_at >= created_at);
