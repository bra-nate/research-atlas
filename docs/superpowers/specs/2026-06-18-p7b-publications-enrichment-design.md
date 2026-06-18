# P7b — Publications Enrichment (OpenAlex) — Design

**Date:** 2026-06-18
**Status:** Approved for planning
**Milestone:** PROMPTS.md **P7** (enrichment), second of two sub-projects.
Builds on **P7a** (migration `0003` already added `project_publications` +
`publication_authors.match_confidence`).

## Goal

Scoped to entities **already in the graph**, pull each person's OpenAlex works and
write `publications` + `publication_authors` (with `match_confidence`), then link
publications to projects by **author-membership** → `project_publications`. Outcome:
the hero person profile shows real outputs; projects show publications via their
members. Idempotent; no runaway ingestion.

## Non-negotiables (baked in)

- **Enrich existing entities only — never mirror OpenAlex.** A work's co-authors
  become `publication_authors` *only* when they resolve to a person already in the
  graph. We never create a new person from a co-author.
- **No bulk org-work pulls.** Works are pulled per-person, capped. Org ROR resolution
  feeds author matching and data quality only — we never page all of an institution's
  works (the runaway risk).
- Provenance on every row: `source`, `source_url`, `ingest_method`, `ingested_at`,
  `verification_status = "ingested_unverified"`.

## Architecture

```
apps/api/src/ingest/
  enrich.ts            NEW — adapter name:"enrich"; orchestrates the two passes
  enrich-normalize.ts  NEW — pure: normalizeWork(work) -> PublicationUpsert,
                       extractAuthorships(work) -> AuthorshipInput[]
  enrich-normalize.test.ts   NEW — unit tests against the works fixture
  openalex-resolve.ts  NEW — resolveOrgToRor, resolveAuthorToOpenAlex (live);
                       pure pickBestAuthor(candidates, orgName) is unit-tested
  openalex-resolve.test.ts   NEW — pickBestAuthor unit tests
  upsert.ts            MODIFY — +upsertPublication, +upsertPublicationAuthor,
                       +upsertProjectPublication
  types.ts             MODIFY — +PublicationUpsert, +AuthorshipInput
  runner.ts            MODIFY — register "enrich"
  __fixtures__/works.A5023888391.json   NEW — committed real OpenAlex works (Awandare)
```

Author→person matching **reuses `resolve.ts`** (`matchPersonToExisting`: orcid →
openalex author id → normalised-name + shared org), so authorship `match_confidence`
uses the same logic as P6. CLI: `pnpm ingest enrich`.

## The fixture seam

`fetchWorksForAuthor(openalexAuthorId: string): Promise<OAWork[]>`:
- `INGEST_LIVE=1` → page the live OpenAlex `works` API filtered by `author.id`,
  capped at `ENRICH_WORKS_CAP` (default 50), via the existing `oaPaginate` helper
  with a field `select` (id, doi, title, publication_date, primary_location,
  authorships).
- otherwise → read `__fixtures__/works.<authorId>.json` if present, else return `[]`.

This makes the whole pipeline runnable offline and deterministic for tests/smoke.

## Pass 1 — resolution (live only, `INGEST_LIVE=1`)

For entities lacking strong keys but carrying enough signal:

- **Orgs** without `ror_id` → `resolveOrgToRor(name, country)` via OpenAlex
  `/institutions?search=<name>`; persist `organizations.ror_id` when the top result's
  display name closely matches (normalised equality / containment) and country agrees.
- **People** with a `primary_org_id` + name but no `orcid`/`openalex_author_id` →
  `resolveAuthorToOpenAlex(name, primaryOrgName)`: OpenAlex `/authors?search=<name>`,
  then `pickBestAuthor(candidates, primaryOrgName)` — choose the candidate whose
  `last_known_institutions` display name matches the person's primary org (prefer
  highest `works_count`); persist `people.openalex_author_id` **only** on an
  institution-corroborated match, else skip + log.

Resolution runs only under `INGEST_LIVE=1` (search responses can't be fixtured
cleanly). Offline runs / smoke rely on ids already present (seeded / from OpenAlex).
`pickBestAuthor` is a pure function and is unit-tested.

## Pass 2 — works → publications → author-membership links

Select every person with an `orcid` or `openalex_author_id`. For each, call
`fetchWorksForAuthor` (capped). For each work:

1. `upsertPublication` — idempotent on `openalex_id`, then `doi`, else insert.
   Fields: `title`, `doi` (bare), `openalexId` (bare), `journal` (primary_location.
   source.display_name), `publicationDate`, `url` (landing_page_url / doi).
2. For each authorship, build a `MatchInput` (orcid, openalex author id, normalised
   `raw_author_name`, `orgId` from the authorship's first institution ROR resolved to
   an org) and call `matchPersonToExisting`. **Only on a match**, `upsertPublicationAuthor`
   with `author_position` = the authorship's 1-based index and `match_confidence` =
   the returned confidence. No new people are created.
3. **Author-membership link**: for each resolved author who is a member of a project
   (`project_members`), `upsertProjectPublication(projectId, publicationId)`,
   provenance `source` = the person's source / `"enrichment"`, `ingest_method =
   "enrichment"`.

## Idempotency

`upsertPublication` resolves on `openalex_id`/`doi`; `upsertPublicationAuthor` dedupes
on `(publication_id, person_id)` (the table's unique key); `upsertProjectPublication`
dedupes on `(project_id, publication_id)`. Re-running `pnpm ingest enrich` converges —
verified by identical counts across two runs (the P6/P7a method).

## Caps & runaway guard

- Per-person works cap (`ENRICH_WORKS_CAP`, default 50); capped pulls recorded in the
  run summary (no silent truncation).
- Iteration is bounded by graph people (those with ids). No org-level work pulls.
- The runner prints publications / publication_authors / project_publications upserted,
  people/orgs resolved, and anything skipped or capped.

## Error handling

A failure normalising/upserting one work or authorship is logged to
`IngestSummary.skipped` and skipped — it never aborts the run. Live HTTP retries with
backoff on 429/5xx via the existing `oaGet`/`oaPaginate`.

## Testing

- **Unit (pure, offline):**
  - `normalizeWork` + `extractAuthorships` against `__fixtures__/works.A5023888391.json`
    (asserts title/doi/openalex id/journal/date; authorship list with positions,
    orcids, institution rors).
  - `pickBestAuthor`: institution-corroborated candidate chosen; ambiguous / no
    institution match → returns null (skip).
- **Smoke (offline via the fixture seam):** seed Gordon Awandare with
  `openalex_author_id = 'A5023888391'`; commit the works fixture; run `pnpm ingest
  enrich`; assert (a) `GET /people/:awandare/publications` returns ≥ 1, (b) a
  `project_publications` row exists linking one of Awandare's consortia to a
  publication, (c) the publication_author row carries `match_confidence` (1.0 via
  ORCID).

## Out of scope

- Crossref (deferred; OpenAlex only).
- Bulk org-work ingestion.
- UI changes — `/publications` and `/people/:id/publications` endpoints already render;
  the "possible authorship" low-confidence label is a later read-side pass (we store the
  `match_confidence` number now).
- Grants / `project_grants` (delivered in P7a).
- `project_publications` via funder/award (OpenAlex no longer exposes award data).
