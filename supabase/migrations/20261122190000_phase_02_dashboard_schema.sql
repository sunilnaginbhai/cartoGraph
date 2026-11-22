create table public.organizations (
  id text primary key,
  created_at timestamptz not null default now()
);

create table public.projects (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  repository_url text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, repository_url),
  unique (id, organization_id)
);

create table public.analyses (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id bigint not null,
  name text not null,
  status text not null check (status in ('queued', 'parsing', 'complete', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);

create table public.files (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id bigint not null,
  path text not null,
  created_at timestamptz not null default now(),
  unique (analysis_id, path),
  unique (id, analysis_id, organization_id),
  foreign key (analysis_id, organization_id)
    references public.analyses(id, organization_id) on delete cascade
);

create table public.edges (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id bigint not null,
  source_file_id bigint not null,
  target_file_id bigint not null,
  created_at timestamptz not null default now(),
  unique (analysis_id, source_file_id, target_file_id),
  foreign key (analysis_id, organization_id)
    references public.analyses(id, organization_id) on delete cascade,
  foreign key (source_file_id, analysis_id, organization_id)
    references public.files(id, analysis_id, organization_id) on delete cascade,
  foreign key (target_file_id, analysis_id, organization_id)
    references public.files(id, analysis_id, organization_id) on delete cascade
);

create table public.routes (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id bigint not null,
  file_id bigint not null,
  method text not null,
  path text not null,
  created_at timestamptz not null default now(),
  unique (analysis_id, method, path),
  foreign key (analysis_id, organization_id)
    references public.analyses(id, organization_id) on delete cascade,
  foreign key (file_id, analysis_id, organization_id)
    references public.files(id, analysis_id, organization_id) on delete cascade
);

create table public.explanations (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id bigint not null,
  file_id bigint not null,
  body text not null,
  created_at timestamptz not null default now(),
  foreign key (analysis_id, organization_id)
    references public.analyses(id, organization_id) on delete cascade,
  foreign key (file_id, analysis_id, organization_id)
    references public.files(id, analysis_id, organization_id) on delete cascade
);

create table public.file_roles (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id bigint not null,
  file_id bigint not null,
  role text not null,
  created_at timestamptz not null default now(),
  unique (analysis_id, file_id),
  foreign key (analysis_id, organization_id)
    references public.analyses(id, organization_id) on delete cascade,
  foreign key (file_id, analysis_id, organization_id)
    references public.files(id, analysis_id, organization_id) on delete cascade
);

create table public.insights (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id bigint not null,
  body text not null,
  created_at timestamptz not null default now(),
  foreign key (analysis_id, organization_id)
    references public.analyses(id, organization_id) on delete cascade
);

create index projects_organization_id_idx on public.projects (organization_id);
create index analyses_organization_id_created_at_idx on public.analyses (organization_id, created_at desc);
create index analyses_project_id_idx on public.analyses (project_id);
create index files_organization_id_idx on public.files (organization_id);
create index files_analysis_id_idx on public.files (analysis_id);
create index edges_organization_id_idx on public.edges (organization_id);
create index edges_analysis_id_idx on public.edges (analysis_id);
create index edges_source_file_id_idx on public.edges (source_file_id);
create index edges_target_file_id_idx on public.edges (target_file_id);
create index routes_organization_id_idx on public.routes (organization_id);
create index routes_analysis_id_idx on public.routes (analysis_id);
create index routes_file_id_idx on public.routes (file_id);
create index explanations_organization_id_idx on public.explanations (organization_id);
create index explanations_analysis_id_idx on public.explanations (analysis_id);
create index explanations_file_id_idx on public.explanations (file_id);
create index file_roles_organization_id_idx on public.file_roles (organization_id);
create index file_roles_analysis_id_idx on public.file_roles (analysis_id);
create index file_roles_file_id_idx on public.file_roles (file_id);
create index insights_organization_id_idx on public.insights (organization_id);
create index insights_analysis_id_idx on public.insights (analysis_id);

alter table public.organizations enable row level security;
alter table public.projects enable row level security;
alter table public.analyses enable row level security;
alter table public.files enable row level security;
alter table public.edges enable row level security;
alter table public.routes enable row level security;
alter table public.explanations enable row level security;
alter table public.file_roles enable row level security;
alter table public.insights enable row level security;

create policy "organization members can read their organization"
on public.organizations for select to authenticated
using (id = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')));

create policy "organization members can read projects"
on public.projects for select to authenticated
using (organization_id = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')));

create policy "organization members can read analyses"
on public.analyses for select to authenticated
using (organization_id = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')));

create policy "organization members can read files"
on public.files for select to authenticated
using (organization_id = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')));

create policy "organization members can read edges"
on public.edges for select to authenticated
using (organization_id = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')));

create policy "organization members can read routes"
on public.routes for select to authenticated
using (organization_id = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')));

create policy "organization members can read explanations"
on public.explanations for select to authenticated
using (organization_id = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')));

create policy "organization members can read file roles"
on public.file_roles for select to authenticated
using (organization_id = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')));

create policy "organization members can read insights"
on public.insights for select to authenticated
using (organization_id = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')));

revoke all on public.organizations, public.projects, public.analyses, public.files,
  public.edges, public.routes, public.explanations, public.file_roles, public.insights
  from anon, authenticated;

grant select on public.organizations, public.projects, public.analyses, public.files,
  public.edges, public.routes, public.explanations, public.file_roles, public.insights
  to authenticated;

insert into public.organizations (id)
values
  ('org_3MSxStvNLpoHfnb6e1N05L0f39r'),
  ('org_3MSwQl31tPMZz1Y4A9pbX52wE6z');

insert into public.projects (organization_id, name, repository_url)
values
  ('org_3MSxStvNLpoHfnb6e1N05L0f39r', 'Cartograph', 'https://github.com/example/cartograph'),
  ('org_3MSwQl31tPMZz1Y4A9pbX52wE6z', 'Atlas UI', 'https://github.com/example/atlas-ui');

insert into public.analyses (organization_id, project_id, name, status, created_at)
select organization_id, id, name, 'complete', now() - interval '2 hours'
from public.projects
where organization_id = 'org_3MSxStvNLpoHfnb6e1N05L0f39r';

insert into public.analyses (organization_id, project_id, name, status, created_at)
select organization_id, id, name, 'parsing', now() - interval '18 minutes'
from public.projects
where organization_id = 'org_3MSwQl31tPMZz1Y4A9pbX52wE6z';
