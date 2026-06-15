# Research Atlas

A **public, read-only directory of the African research ecosystem** — organisations,
the people in them, and their capabilities — aggregated from public sources.
"Crunchbase for African research consortia." See `CLAUDE.md`, `ARCHITECTURE.md`,
`DESIGN.md`, `UI-PLAN.md`, `PROMPTS.md` for the product spec.

This is a **separate product** from ACE Connect (different repo, brand, deployment,
and **its own database**). It only **shares the data model's shape and the codebase
template** — a Vite SPA + Express API + Postgres + a `/packages/types` module — so we
"build once." It never connects to ACE Connect's database.

## Layout (pnpm monorepo)

```
/packages/types   @research-atlas/types — shared entity shapes (Organization,
                  Person, Capability) + enums. Seeded from the cross-product model;
                  extend here with the Directory graph (programs, projects, grants,
                  publications, edges) as DATA.md is finalised.
/apps/api         @research-atlas/api — Express + TypeScript REST API (Drizzle on
                  Postgres). The ONLY thing that touches the DB. Public + read-only
                  in V1 (no auth). The browser never connects to Postgres directly.
/apps/web         @research-atlas/web — Vite + React SPA. Talks ONLY to the API via
                  React Query. Public discovery UI.
```

## V1 scope (this build)
Ingest public data → normalise → entity-resolve → **browse** (no accounts, no
contact, no claim). Provenance on every record. Hero feature: cross-consortium
people aggregation (one person, every programme they appear in).

## Run it

```bash
pnpm install

# API — copy apps/api/.env.example → apps/api/.env and set DATABASE_URL
pnpm dev:api      # http://localhost:4000

# SPA (proxies /api → :4000)
pnpm dev:web      # http://localhost:5173
```

## Data model (in `@research-atlas/types` + `supabase/migrations/0001_init.sql`)
Entities: `organizations`, `people`, `capabilities`, `programs`, `projects`,
`grants`, `publications`. Graph edges: `project_members`, `project_partners`,
`publication_authors`. Every row carries provenance (`source`, `source_url`,
`ingest_method`, `ingested_at`, `verification_status`). Entity-resolution keys are
first-class: `ror_id`, `orcid`, `openalex_author_id`, `doi`, `openalex_id`.

The hero traversal is live: `GET /people/:id/projects` returns every project a
person is on across all programmes (and `GET /projects/:id/members` the inverse).

## Status / next
Seeded from the ACE Connect re-platform as the shared codebase template, stripped
of all ACE-private features (auth, connection requests, outcomes, meetings, admin
writes), then built out to the full Directory model above. Verified: `pnpm -r build`
+ `typecheck` green; the migration applies on Postgres; `apps/api/test/smoke.sh`
passes (read endpoints + the person→project graph).

**Next:** the ingestion adapters (`/ingest`, one per source — see `INGEST.md` once
restored), real seed data, and the entity/profile pages in the SPA (programmes,
projects, person profiles with bidirectional links). `publication_authors` was
added during scaffolding because DATA.md's edge list was truncated — confirm it
when `DATA.md` is restored.
