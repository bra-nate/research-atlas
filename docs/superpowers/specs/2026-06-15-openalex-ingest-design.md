# OpenAlex Ingest Adapter + Hero Consortium Seed — Design

**Date:** 2026-06-15
**Status:** Approved for planning
**Milestone:** First ingestion pipeline + real seed data (README "Next" item, part 1).
SPA profile pages are a separate, later milestone.

## Goal

Fill the currently-empty Directory database with real, resolvable data so the
**cross-consortium people feature works end-to-end on real names**, and lay down the
adapter scaffolding that future sources will reuse.

The headline test (from CLAUDE.md): Prof. Gordon Awandare resolves to **one** person
whose profile spans WACCBIP (under the ACE programme) + SickleGenAfrica (under
H3Africa) + a DELTAS consortium — a span no single source portal shows.

## Terminology (locked)

- **Programme** = `programs` table — the funder/umbrella initiative (ACE, H3Africa, DELTAS).
- **Consortium** = `projects` table — a funded node under a programme (WACCBIP, SickleGenAfrica).
  The `projects` type comment is tightened to say "consortium node" to remove the
  current ambiguity (the word "consortium" presently appears at both tiers).

## Publications policy (locked)

Publications are **background signal, not a product feature.** OpenAlex is a
publications database, so works are how we *discover* people, their institutions, and
their funding — but we do not build a publications browse page or a paper-by-paper
author listing.

What we keep from works:
- Discovery + resolution of people (ORCID / OpenAlex author id) and organisations (ROR).
- Derived **activity signal** stored on the person: a works count, a most-recent
  active year, and top research themes (→ `people.specializations`).

Works are read **transiently** to compute the above — we do **not** write `publications`
rows in this milestone. The person's existing `profile_url` (their OpenAlex/ORCID page)
serves as the provenance link back to their outputs.

What we do NOT build:
- No publications browse/list UI.
- No `publications` rows written, and no `publication_authors` author-listing
  machinery — that table stays empty and unused this milestone (the resolution-shape
  change discussed earlier is therefore deferred, not needed now).

## Sources

1. **OpenAlex** (primary, first adapter) — free, no API key. Supplies people,
   organisations, funding, and the resolution keys.
2. **Hand-curated consortium fixture** — a tiny static file supplying the
   programme→consortium→membership structure OpenAlex does not model. This is the
   tier the hero traversal walks.

## Seed boundary

- **Institutions (spine):** a curated list of ~10–15 African research institutions by
  ROR id. The adapter pulls their researchers and funding.
- **People (hero guarantee):** a small list of hero ORCIDs (Awandare et al.) so the
  headline people are present and well-connected regardless of institution coverage.
- **Consortia (fixture):** ~30 rows — ACE→WACCBIP, H3Africa→SickleGenAfrica, a DELTAS
  consortium, plus their memberships — each with a real `source_url` and
  `verification_status = 'ingested_unverified'`.

## Architecture

```
apps/api/src/ingest/
  types.ts            Adapter interface: fetch() -> normalize() -> upsert()
  runner.ts           CLI: `pnpm ingest <name>` — runs an adapter, prints a summary
  upsert.ts           shared idempotent upserts keyed on natural keys
  resolve.ts          inline person resolution (orcid / openalex_author_id -> people)
  http.ts             OpenAlex client: polite pool (mailto), cursor pagination, backoff
  openalex.ts         the OpenAlex adapter
  seed-consortia.ts   loads the hero fixture through the same upsert layer
  seeds/
    institutions.ror.json
    people.orcid.json
    consortia.json
  __fixtures__/       saved OpenAlex JSON responses for normalize() unit tests
```

The adapter is the only new thing that writes to the DB, consistent with the rule that
all DB access lives in the API package.

## Data flow

1. **OpenAlex adapter** — for each seeded ROR institution and hero ORCID:
   - Fetch the institution / author records and a capped, most-recent set of their
     works (cursor-paged; cap default 200/institution, configurable).
   - From those, normalise: the organisation, the people (with ORCID /
     openalex_author_id), their funders (→ programmes/grants), and the derived
     per-person activity signal (works count, last active year, top themes).
2. **Upsert order** (respects foreign keys):
   `organizations` -> `programs` (from funders) -> `people` (inline-resolved) ->
   `grants`. Derived signal is written onto the `people` rows.
3. **Consortium seed adapter** — upserts `programs`, `projects`, `project_members`
   from `consortia.json`, supplying the consortium tier and the memberships the hero
   traversal needs.
4. Every row carries provenance: `source`, `source_url`, `ingest_method`,
   `ingested_at`, `verification_status = 'ingested_unverified'`.

## Idempotency & resolution

- All writes are **upserts on stable natural keys** — `openalex_id` / `ror_id`
  (orgs), `orcid` / `openalex_author_id` (people), funder id (programmes). Re-running
  any adapter is safe and convergent; no blind inserts, no duplicates.
- **Person resolution is inline:** an incoming `orcid` / `openalex_author_id` is
  matched to an existing person and updated, or a new person is created. No separate
  batch resolution pass in this milestone.

## Schema changes (prerequisite)

A single small migration `0002_person_activity_signal.sql`, mirrored in the Drizzle
schema and `@research-atlas/types`:

- Add to `people`: `works_count integer`, `last_active_year integer`. (Top themes
  reuse the existing `specializations text[]`.)
- Tighten the `projects` type comment to "consortium node".

No change to `publication_authors` in this milestone (publications stay background-only).

## Error handling

- A normalise failure on one record is logged and skipped — it does not abort the run.
- HTTP calls retry with backoff on 429 / 5xx; hard-fail only after retries are
  exhausted.
- The runner prints a summary: rows upserted per table, plus records skipped and any
  per-institution work caps that truncated results (no silent truncation).

## Testing

- `normalize()` is unit-tested against saved `__fixtures__` OpenAlex JSON — no live
  API calls in tests.
- `apps/api/test/smoke.sh` is extended to assert the hero traversal: after seeding,
  `GET /people/:awandare/projects` returns consortia spanning **at least two
  programmes**.

## Out of scope (explicit)

- SPA profile / browse pages (separate milestone).
- A second, scraping-based programme adapter.
- Batch / scheduled re-resolution and any cron scheduling.
- Any publications browse feature or author-listing UI.
