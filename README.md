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

## Status / next
Seeded from the ACE Connect re-platform as the shared codebase template, then
stripped of all ACE-private features (auth, connection requests, outcomes, meetings,
admin writes). The current data model carries `organizations` / `people` /
`capabilities`; the Directory-specific graph (`programs`, `projects`, `grants`,
`publications` + edge tables) and the ingestion adapters (`/ingest`) are the next
build — see `ARCHITECTURE.md` and the (to-be-restored) `DATA.md` / `INGEST.md`.
