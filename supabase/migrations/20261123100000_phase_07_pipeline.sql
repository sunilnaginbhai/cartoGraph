alter table public.analyses
  add column stage text not null default 'fetching'
    check (stage in ('fetching', 'selecting', 'parsing', 'storing', 'complete', 'failed')),
  add column stage_message text not null default 'Waiting to fetch the repository',
  add column failed_stage text,
  add column error_message text,
  add column coverage jsonb,
  add constraint analyses_one_per_project unique (project_id),
  add constraint analyses_failed_state_has_reason check (
    status <> 'failed' or (failed_stage is not null and error_message is not null)
  );

alter table public.files
  add column folder text not null default '.',
  add column extension text not null default '',
  add column module_kind text not null default 'script'
    check (module_kind in ('es-module', 'commonjs', 'script')),
  add column role text,
  add column lines integer not null default 0 check (lines >= 0),
  add column hash text not null default '',
  add column fan_in integer not null default 0 check (fan_in >= 0),
  add column fan_out integer not null default 0 check (fan_out >= 0);

alter table public.edges
  add column kind text not null default 'import'
    check (kind in ('import', 're-export', 'dynamic-import')),
  add column specifier text not null default '';

create or replace function public.publish_analysis_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('stage', new.stage, 'message', new.stage_message),
    'progress',
    'analysis:' || new.id::text,
    true
  );
  return new;
end;
$$;

create trigger analyses_publish_progress
after update of stage, stage_message on public.analyses
for each row
when (old.stage is distinct from new.stage or old.stage_message is distinct from new.stage_message)
execute function public.publish_analysis_progress();

create view public.analysis_dashboard
with (security_invoker = true)
as
select
  id, name, status, stage, stage_message, commit_sha, created_at, updated_at, finished_at,
  status in ('queued', 'parsing') and updated_at < now() - interval '5 minutes' as is_stale
from public.analyses;

grant select on public.analysis_dashboard to authenticated;
