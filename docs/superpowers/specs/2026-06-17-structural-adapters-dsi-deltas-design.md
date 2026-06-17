# DS-I Africa + DELTAS Africa Structural Adapters — Design

**Date:** 2026-06-17
**Status:** Approved for planning
**Milestone:** PROMPTS.md **P6 — More structural sources.**

## Goal

Add two `scrape`-method ingest adapters that populate the **structural tier**
(programme → projects/consortia → people + partner organisations) from two real
African research programmes, and **prove cross-source entity resolution on real
data** — the P6 "Done" criteria.

Headline proofs (both on real data):

- **Org resolution:** *University of Ghana* (and likely University of Cape Town /
  KEMRI) appears in **both** the DS-I Africa and DELTAS Africa fixtures and resolves
  to **one** organisation row (matched by ROR, then name).
- **Person resolution / hero:** DELTAS Africa's real **WACCBIP-DELTAS** consortium is
  led by **Prof. Gordon Awandare** (University of Ghana, ORCID
  `0000-0002-8793-3641`). He resolves onto the **existing** Awandare already present
  from the OpenAlex / `seed-consortia` data, so the cross-consortium hero footprint
  now includes a consortium sourced from a genuine structural source (`deltas`),
  not the placeholder seed row.

## Sources

1. **DS-I Africa** (`https://dsi-africa.org`) — NIH Common Fund programme composed of
   research/data-science **hubs**. Each hub page yields: a project (the hub), its PI
   (person), and its partner institutions (organisations).
2. **DELTAS Africa** (`https://www.aasciences.africa/deltas`) — AAS/AESA programme
   composed of **consortia**. Each consortium yields: a project, its lead organisation,
   its director (person, role `pi`), and its partner organisations.

Both map cleanly onto the existing schema — **no migration needed**.

## Acquisition — fixture-driven parsers

Each adapter reads a committed HTML **snapshot** from `__fixtures__/` by default, so
runs are deterministic and CI never touches the network (mirrors the OpenAlex pattern,
which tests `normalize()` against saved JSON fixtures).

- Snapshots are captured **once from the real pages** so the ingested data is honest.
  Capture is done during implementation (manual fetch / `WebFetch`), and the saved HTML
  is committed.
- An env flag `INGEST_LIVE=1` makes the adapter re-fetch from the live site through a
  shared `httpGet` helper (User-Agent + retry/backoff, modelled on `http.ts`); this is
  how snapshots get refreshed. Default (no flag) = read the committed snapshot.
- HTML parsing uses **`node-html-parser`** (tiny, dependency-light) — chosen over
  hand-rolled regex for robustness. Added to `apps/api` deps.

## Architecture

```
apps/api/src/ingest/
  resolve.ts            NEW — matchPersonToExisting({orcid, openalexAuthorId, name, orgId})
  upsert.ts             EXTEND — upsertProgram / upsertProject / upsertProjectMember /
                        upsertProjectPartner (promoted shared idempotent edge upserts)
  dsi-africa.ts         NEW — DS-I Africa adapter
  deltas.ts             NEW — DELTAS Africa adapter
  dsi-africa-normalize.ts   NEW — parse(html) -> normalised records
  deltas-normalize.ts       NEW — parse(html) -> normalised records
  scrape-http.ts        NEW — generic httpGet (live fetch behind INGEST_LIVE)
  runner.ts             EXTEND — register "dsi-africa" and "deltas"
  types.ts              EXTEND — ProgramUpsert, ProjectUpsert, member/partner edge types
  __fixtures__/
    dsi-africa.html     NEW — committed real snapshot
    deltas.html         NEW — committed real snapshot
```

`seed-consortia.ts` is **left untouched** — it works and is covered by the smoke test.
Its program/project/membership logic is the thing being generalised into `upsert.ts`,
but re-pointing it at the shared helpers is deliberately out of scope to avoid
disturbing a passing path.

## Normalisation → resolution → upsert

New normalised types in `types.ts`:

- `ProgramUpsert { name, shortName, region, website, sourceUrl }`
- `ProjectUpsert { title, programName, leadOrg?, piPerson?, partners[], country, sourceUrl }`
  where `leadOrg`/`partners` are `OrgUpsert` and `piPerson` is `PersonUpsert`, each
  carrying a `partnerRole` / `memberRole` where relevant.

New shared upserts in `upsert.ts` (all idempotent on natural keys):

- `upsertProgram` — resolve by `lower(name)`; returns id.
- `upsertProject` — resolve by `lower(title)` (+ `program_id`); links `leadOrgId` /
  `piPersonId`; returns id.
- `upsertProjectMember` — dedupe on `(project_id, person_id, role)`.
- `upsertProjectPartner` — dedupe on `(project_id, org_id, role)`.

New `resolve.ts`:

- `matchPersonToExisting({ orcid, openalexAuthorId, name, orgId }) -> { personId, confidence } | null`
  - ORCID match → `confidence: 1.0`
  - OpenAlex author-id match → `confidence: 0.95`
  - normalised-name match **only when corroborated by a shared `primary_org_id`** →
    `confidence: 0.7`
  - name-only (no org agreement) → **no match** (returns `null`); a new person is created.
- `upsertPerson` is updated to consult `matchPersonToExisting` before its current
  ORCID/OpenAlex-id lookup, so scraped people without an ORCID can still attach to an
  existing person when the org agrees. Behaviour for ORCID-bearing people is unchanged.

**Upsert order** (respects FKs): organisations → programmes → people → projects (link
leadOrg + PI) → `project_members` → `project_partners`.

**Provenance** on every row: `source` = `"dsi-africa"` / `"deltas"`,
`ingest_method` = `"scrape"`, real `source_url` (the hub/consortium page),
`verification_status` = `"ingested_unverified"`.

## Idempotency

All writes are upserts on stable natural keys (ROR/name for orgs, ORCID/OpenAlex-id/
name+org for people, name for programmes, title+programme for projects, edge tuples
for membership/partnership). Re-running either adapter is convergent — no duplicates.

## Error handling

- A parse failure on one record is logged to `summary.skipped` and skipped — it does
  not abort the run (matches OpenAlex adapter behaviour).
- Live fetch (only under `INGEST_LIVE=1`) retries with backoff on 429 / 5xx, hard-fails
  after retries.
- The runner prints rows-upserted-per-table plus anything skipped — no silent
  truncation.

## Testing

- **Parser unit tests** (`dsi-africa-normalize.test.ts`, `deltas-normalize.test.ts`)
  run `parse()` against the committed HTML fixtures and assert the extracted records
  (project titles, PI names, partner orgs, the Awandare/University-of-Ghana rows).
- **Resolver unit test** (`resolve.test.ts`): ORCID hit, OpenAlex-id hit, name+org hit
  (confidence 0.7), name-only rejected (null).
- **Smoke test** (`apps/api/test/smoke.sh`) extended: after `seed-consortia` +
  `dsi-africa` + `deltas` ingests, assert
  1. a shared institution (expected: *University of Ghana*; the exact org is confirmed
     when the real snapshots are captured) exists as exactly **one** org row, reachable
     from projects of **two different source programmes**; and
  2. `GET /people/:awandare/projects` returns at least one project whose `source` is
     `"deltas"` (real structural source feeding the hero footprint).

## Out of scope (explicit)

- Grants / publications enrichment (that is **P7**).
- SPA / browse UI changes.
- Refactoring `seed-consortia.ts` onto the shared upserts.
- Live scraping in CI (live fetch is opt-in via `INGEST_LIVE=1` only).
- Any contact data, accounts, or claim flow (V1 guardrails).
