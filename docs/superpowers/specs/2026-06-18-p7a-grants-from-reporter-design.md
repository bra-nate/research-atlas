# P7a — Grants from NIH RePORTER → project_grants — Design

**Date:** 2026-06-18
**Status:** Approved for planning
**Milestone:** PROMPTS.md **P7** (enrichment), first of two sub-projects.
Companion: **P7b — Publications enrichment** (separate spec/plan, built next).

## Why this split

P7 has two halves with different real sources and risk profiles. OpenAlex no
longer exposes per-work grant/award data (empirically: 0 grants across Awandare's,
Mulder's, a Berkeley, and a global sample of works; `select=grants` now 400s), so
grants cannot come from OpenAlex. They **can** come precisely from NIH RePORTER,
which we already use for DS-I Africa and which carries real award numbers, amounts,
and dates. P7a delivers that half — small, precise, no entity-resolution risk — and
builds the shared migration + project-edge upsert pattern that P7b reuses.

## Goal

For every DS-I Africa project (sourced from RePORTER), create its real **grant**
(award number, funder = NIH, amount, dates) and link it to the project via
**`project_grants`**. Idempotent. Satisfies the P7 "some grants populated" outcome
with authoritative, project-linked data.

DELTAS consortia carry no award data in our sources, so they get no grants in P7a —
that is expected and acceptable.

## Schema migration `0003` (shared with P7b — built here, once)

A single migration `supabase/migrations/0003_enrichment_edges.sql`, mirrored in the
Drizzle schema (`apps/api/src/db/schema.ts`) and `@research-atlas/types`:

- **New `project_grants`** — `id uuid pk`, `project_id uuid not null → projects(id)
  on delete cascade`, `grant_id uuid not null → grants(id) on delete cascade`,
  provenance columns, `unique (project_id, grant_id)`; btree indexes on both FKs.
- **New `project_publications`** (created here for P7b; unused in P7a) —
  `id uuid pk`, `project_id uuid not null → projects(id) on delete cascade`,
  `publication_id uuid not null → publications(id) on delete cascade`, provenance,
  `unique (project_id, publication_id)`; btree indexes on both FKs.
- **Add `match_confidence numeric`** to `publication_authors` (for P7b).

Building all three now keeps a single migration as the brainstorm agreed; P7a only
writes `project_grants`.

## Data source — extend the DS-I fixture

Re-pull the committed DS-I RePORTER fixture
(`apps/api/src/ingest/__fixtures__/dsi-africa.reporter.json`) adding award fields:
`AwardAmount`, `AgencyIcAdmin`, `ProjectStartDate`, `ProjectEndDate` (in addition to
the existing fields). The existing DS-I parser tests assert title/org/PI and are
unaffected. Live refresh stays behind `INGEST_LIVE=1` as today.

## Normalisation → upsert (extends the existing DS-I adapter)

Grants are part of DS-I award data, so emission lives in the DS-I adapter rather than
a separate ingester:

- **`GrantUpsert`** (in `types.ts`) gains optional `amount: string | null`,
  `currency: string | null`, `startDate: string | null`, `endDate: string | null`.
- **`ProjectUpsert`** gains optional `grant: GrantUpsert | null`.
- **`parseDsiAfrica`** populates `project.grant` per award:
  - `awardNumber` = `core_project_num` (the stable core, e.g. `U54TW012084`).
  - `name` = `"NIH <core_project_num>"`.
  - `funder` = an `OrgUpsert` for **National Institutes of Health (NIH)**,
    `orgType: "funder"`, country `"United States"`.
  - `amount` = `award_amount` (string) when present; `currency` = `"USD"`.
  - `startDate` / `endDate` = `project_start_date` / `project_end_date` (date strings)
    when present, else null.
  - `sourceUrl` = the RePORTER project-details URL (same as the project).
- **`upsertGrant`** (in `upsert.ts`) extends to write the new amount/currency/date
  columns; resolution key unchanged (`award_number` when present, else lower(name)).
- **`upsertProject`**: after upserting the project, if `proj.grant` is set, call
  `upsertGrant` then `upsertProjectGrant(projectId, grantId, sourceUrl, prov)`.
- **New `upsertProjectGrant`** — idempotent edge keyed on `(project_id, grant_id)`.

Grant resolution by `award_number` means re-running the DS-I adapter is convergent —
no duplicate grants or edges.

## Provenance

Grants and `project_grants` carry `source = "dsi-africa"`, `ingest_method = "api"`,
`source_url` = the RePORTER project-details URL, `verification_status =
"ingested_unverified"` — consistent with the DS-I projects they belong to.

## Idempotency

`upsertGrant` resolves on `award_number`; `upsertProjectGrant` dedupes on
`(project_id, grant_id)`. Re-running `pnpm ingest dsi-africa` converges (verified the
same way P6 idempotency was: counts identical across two runs).

## Error handling

A grant/edge failure on one award is logged to `IngestSummary.skipped` and skipped —
it does not abort the run. The runner already prints per-table upserts + skipped.

## Testing

- **Unit** (`dsi-africa-normalize.test.ts`, extended): `parseDsiAfrica` emits a
  `grant` for an award with `awardNumber` = the core project number, funder = NIH
  (`orgType: "funder"`), and amount when present.
- **Idempotency**: two consecutive `dsi-africa` ingests into a temp DB yield identical
  `grants` and `project_grants` counts.
- **Smoke** (`apps/api/test/smoke.sh`, extended): after the DS-I ingest, assert a
  DS-I project has a `project_grants` row whose grant `award_number` matches a RePORTER
  core project number and whose funder org is NIH (`org_type = 'funder'`).

## Out of scope (P7a)

- Publications, `publication_authors`, `project_publications`, `match_confidence`
  population — all **P7b**.
- Any OpenAlex calls or entity resolution to OpenAlex — **P7b**.
- DELTAS grants (no award data in source).
- Grant amounts/dates for non-DS-I sources.
- Read-path UI changes (endpoints already exist; surfacing is a later pass).
