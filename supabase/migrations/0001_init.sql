-- ============================================================================
-- Research Directory — initial schema (V1: public, read-only)
--
-- The public graph of the African research ecosystem. Mirrors DATA.md and
-- @research-atlas/types. Every entity/edge carries provenance. No auth/accounts
-- tables in V1 (the API is the only DB client; the browser never connects).
--
-- Entity resolution keys are first-class: ror_id (orgs), orcid/openalex_author_id
-- (people), doi/openalex_id (publications) — they power the cross-consortium
-- people aggregation hero feature.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type org_type            as enum ('ace','university','research_centre','consortium','institute','funder','company');
create type verification_status as enum ('ingested_unverified','claimed','verified');
create type ingest_method       as enum ('manual','csv','scrape','api','enrichment');
create type member_role         as enum ('pi','co_pi','investigator','fellow','student','collaborator');
create type partner_role        as enum ('lead','hub','partner','funder');
create type capability_kind     as enum ('equipment','facility','service');

-- ----------------------------------------------------------------------------
-- Shared helpers
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- IMMUTABLE text[] → text for use in generated tsvector columns.
create or replace function public.immutable_array_to_string(arr text[], sep text)
  returns text language sql immutable parallel safe
as $$ select array_to_string(arr, sep) $$;

-- Provenance columns are repeated on every ingested table:
--   source text · source_url text · ingest_method ingest_method ·
--   ingested_at timestamptz · verification_status default 'ingested_unverified'

-- ----------------------------------------------------------------------------
-- organizations
-- ----------------------------------------------------------------------------
create table public.organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  short_name          text,
  org_type            org_type not null default 'university',
  country             text,
  description         text,
  website             text,
  logo_url            text,
  ror_id              text,
  source              text,
  source_url          text,
  ingest_method       ingest_method,
  ingested_at         timestamptz,
  verification_status verification_status not null default 'ingested_unverified',
  last_verified_at    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  search_fts tsvector generated always as (
    to_tsvector('english',
      coalesce(name,'') || ' ' || coalesce(short_name,'') || ' ' ||
      coalesce(country,'') || ' ' || coalesce(description,''))
  ) stored
);
create index idx_organizations_ror        on public.organizations (ror_id);
create index idx_organizations_type       on public.organizations (org_type);
create index idx_organizations_country    on public.organizations (country);
create index idx_organizations_search_fts on public.organizations using gin (search_fts);
create trigger trg_organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- people  (no contact fields — public professional info only)
-- ----------------------------------------------------------------------------
create table public.people (
  id                    uuid primary key default gen_random_uuid(),
  full_name             text not null,
  normalised_name       text,
  title                 text,
  primary_org_id        uuid references public.organizations (id) on delete set null,
  highest_qualification text,
  specializations       text[] not null default '{}',
  skills                text[] not null default '{}',
  bio                   text,
  orcid                 text,
  openalex_author_id    text,
  profile_url           text,
  photo_url             text,
  visible               boolean not null default true,
  merged_into           uuid references public.people (id) on delete set null,
  source                text,
  source_url            text,
  ingest_method         ingest_method,
  ingested_at           timestamptz,
  verification_status   verification_status not null default 'ingested_unverified',
  search_fts tsvector generated always as (
    to_tsvector('english',
      coalesce(full_name,'') || ' ' || coalesce(title,'') || ' ' ||
      coalesce(bio,'') || ' ' ||
      coalesce(public.immutable_array_to_string(skills,' '),'') || ' ' ||
      coalesce(public.immutable_array_to_string(specializations,' '),''))
  ) stored
);
create unique index uq_people_orcid    on public.people (orcid)   where orcid is not null;
create unique index uq_people_openalex on public.people (openalex_author_id) where openalex_author_id is not null;
create index idx_people_primary_org     on public.people (primary_org_id);
create index idx_people_normalised_name on public.people (normalised_name);
create index idx_people_merged_into     on public.people (merged_into);
create index idx_people_skills_gin      on public.people using gin (skills);
create index idx_people_specs_gin       on public.people using gin (specializations);
create index idx_people_search_fts      on public.people using gin (search_fts);

-- ----------------------------------------------------------------------------
-- programs  (funding programme / consortium umbrella)
-- ----------------------------------------------------------------------------
create table public.programs (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  short_name          text,
  funders             text[] not null default '{}',
  focus_areas         text[] not null default '{}',
  region              text,
  website             text,
  description         text,
  logo_url            text,
  source              text,
  source_url          text,
  ingest_method       ingest_method,
  ingested_at         timestamptz,
  verification_status verification_status not null default 'ingested_unverified'
);
create index idx_programs_focus_gin on public.programs using gin (focus_areas);

-- ----------------------------------------------------------------------------
-- projects  (a funded project / hub under a programme)
-- ----------------------------------------------------------------------------
create table public.projects (
  id                  uuid primary key default gen_random_uuid(),
  program_id          uuid references public.programs (id) on delete set null,
  title               text not null,
  lead_org_id         uuid references public.organizations (id) on delete set null,
  pi_person_id        uuid references public.people (id) on delete set null,
  status              text,
  themes              text[] not null default '{}',
  funding_note        text,
  country             text,
  description         text,
  source              text,
  source_url          text,
  ingest_method       ingest_method,
  ingested_at         timestamptz,
  verification_status verification_status not null default 'ingested_unverified',
  search_fts tsvector generated always as (
    to_tsvector('english',
      coalesce(title,'') || ' ' || coalesce(description,'') || ' ' ||
      coalesce(public.immutable_array_to_string(themes,' '),''))
  ) stored
);
create index idx_projects_program     on public.projects (program_id);
create index idx_projects_lead_org     on public.projects (lead_org_id);
create index idx_projects_pi           on public.projects (pi_person_id);
create index idx_projects_themes_gin   on public.projects using gin (themes);
create index idx_projects_search_fts   on public.projects using gin (search_fts);

-- ----------------------------------------------------------------------------
-- capabilities  (equipment/facility/service — descriptive only)
-- ----------------------------------------------------------------------------
create table public.capabilities (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations (id) on delete cascade,
  kind                capability_kind not null,
  name                text not null,
  category            text,
  description         text,
  access_note         text,
  country             text,
  city                text,
  source              text,
  source_url          text,
  ingest_method       ingest_method,
  ingested_at         timestamptz,
  verification_status verification_status not null default 'ingested_unverified',
  search_fts tsvector generated always as (
    to_tsvector('english',
      coalesce(name,'') || ' ' || coalesce(category,'') || ' ' || coalesce(description,''))
  ) stored
);
create index idx_capabilities_org        on public.capabilities (org_id);
create index idx_capabilities_kind       on public.capabilities (kind);
create index idx_capabilities_search_fts on public.capabilities using gin (search_fts);

-- ----------------------------------------------------------------------------
-- grants  (funding awards)
-- ----------------------------------------------------------------------------
create table public.grants (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  funder_org_id       uuid references public.organizations (id) on delete set null,
  award_number        text,
  amount              numeric,
  currency            text,
  start_date          date,
  end_date            date,
  description         text,
  source              text,
  source_url          text,
  ingest_method       ingest_method,
  ingested_at         timestamptz,
  verification_status verification_status not null default 'ingested_unverified'
);
create index idx_grants_funder on public.grants (funder_org_id);

-- ----------------------------------------------------------------------------
-- publications  (research outputs)
-- ----------------------------------------------------------------------------
create table public.publications (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  doi                 text,
  openalex_id         text,
  journal             text,
  publication_date    date,
  abstract            text,
  url                 text,
  source              text,
  source_url          text,
  ingest_method       ingest_method,
  ingested_at         timestamptz,
  verification_status verification_status not null default 'ingested_unverified',
  search_fts tsvector generated always as (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(abstract,'') || ' ' || coalesce(journal,''))
  ) stored
);
create unique index uq_publications_doi     on public.publications (doi)         where doi is not null;
create unique index uq_publications_openalex on public.publications (openalex_id) where openalex_id is not null;
create index idx_publications_search_fts    on public.publications using gin (search_fts);

-- ----------------------------------------------------------------------------
-- Edge tables (the graph)
-- ----------------------------------------------------------------------------
create table public.project_members (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects (id) on delete cascade,
  person_id           uuid not null references public.people (id)   on delete cascade,
  role                member_role,
  source              text,
  source_url          text,
  ingest_method       ingest_method,
  ingested_at         timestamptz,
  verification_status verification_status not null default 'ingested_unverified',
  unique (project_id, person_id, role)
);
create index idx_project_members_project on public.project_members (project_id);
create index idx_project_members_person  on public.project_members (person_id);

create table public.project_partners (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects (id)      on delete cascade,
  org_id              uuid not null references public.organizations (id) on delete cascade,
  role                partner_role,
  source              text,
  source_url          text,
  ingest_method       ingest_method,
  ingested_at         timestamptz,
  verification_status verification_status not null default 'ingested_unverified',
  unique (project_id, org_id, role)
);
create index idx_project_partners_project on public.project_partners (project_id);
create index idx_project_partners_org     on public.project_partners (org_id);

-- publication_authors: added during scaffolding (DATA.md edge list was truncated).
create table public.publication_authors (
  id                  uuid primary key default gen_random_uuid(),
  publication_id      uuid not null references public.publications (id) on delete cascade,
  person_id           uuid not null references public.people (id)       on delete cascade,
  author_position     integer,
  source              text,
  source_url          text,
  ingest_method       ingest_method,
  ingested_at         timestamptz,
  verification_status verification_status not null default 'ingested_unverified',
  unique (publication_id, person_id)
);
create index idx_publication_authors_pub    on public.publication_authors (publication_id);
create index idx_publication_authors_person on public.publication_authors (person_id);
