-- 0003: enrichment edges. project_grants (P7a) links a project to its funding
-- award; project_publications (P7b) links a project to a publication; and
-- publication_authors gains match_confidence for fuzzy author resolution (P7b).

create table public.project_grants (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects (id) on delete cascade,
  grant_id            uuid not null references public.grants (id)   on delete cascade,
  source              text,
  source_url          text,
  ingest_method       ingest_method,
  ingested_at         timestamptz,
  verification_status verification_status not null default 'ingested_unverified',
  unique (project_id, grant_id)
);
create index idx_project_grants_project on public.project_grants (project_id);
create index idx_project_grants_grant   on public.project_grants (grant_id);

create table public.project_publications (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects (id)     on delete cascade,
  publication_id      uuid not null references public.publications (id) on delete cascade,
  source              text,
  source_url          text,
  ingest_method       ingest_method,
  ingested_at         timestamptz,
  verification_status verification_status not null default 'ingested_unverified',
  unique (project_id, publication_id)
);
create index idx_project_publications_project on public.project_publications (project_id);
create index idx_project_publications_pub     on public.project_publications (publication_id);

alter table public.publication_authors add column if not exists match_confidence numeric;
