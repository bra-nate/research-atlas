# World Bank ACE ingest adapter — design

**Date:** 2026-06-20
**Status:** approved, in implementation

## Goal

Ingest the World Bank / AAU **Africa Centres of Excellence (ACE)** ecosystem into
research-atlas: ~41 ACE centres and ~402 faculty, sourced from the old ACE Connect
project (`/Users/Nate/Desktop/Nathan/ACE`). This adds breadth to the data graph and
feeds the hero feature (cross-consortium people aggregation) by populating the
already-seeded **Africa Centres of Excellence** programme with real centres and people.

## Source data

The old ACE project stores its data only as Postgres seed SQL
(`supabase/seed.sql`) — no JSON/CSV exports. Relevant tables:

- `ace_centres` (41): `name`, `short_name`, `host_university`, `country`,
  `ace_phase` (`ace_1|ace_2|ace_impact`), `thematic_areas` (text[]), `website`.
- `experts` (402): `centre_id` (resolved via `short_name` sub-select), `full_name`,
  `title`, `specializations` (text[]; 170 populated, 216 intentionally blank where the
  source factsheet font was undecodable — never fabricated).

Out of scope (ACE-Connect-specific, no place in this read-only public product):
`availability_basis`, `credential_status`, `skills`, equipment, services.

No external identifiers exist (no ORCID/ROR/email). WACCBIP, SickleGenAfrica and the
DELTAS fellowship — the three already-seeded consortia — are **absent** from the old
data, so there are no project collisions and the curated hero record stays intact.

## Mapping → research-atlas (`ProjectUpsert`)

| Old ACE | research-atlas | Notes |
|---|---|---|
| the programme | Programme **`Africa Centres of Excellence`** | Reuse exact seeded name (key `ace`); resolves into existing row, does not create a new programme. |
| ACE centre | `ProjectUpsert` | `title` = centre name, `country`. The centre *is* the consortium — not a separate org. |
| `host_university` | lead org | partner role `lead`, `orgType: "university"`, title-cased name for cross-source resolution. |
| — | funder partners | `World Bank Group` (`orgType: "funder"`, role `funder`) + `Association of African Universities` (`orgType: "institute"`, role `partner`). No grant amount/number → `grant: null`. |
| expert | `MemberEdge` | role `investigator`; `PersonUpsert` with `fullName`, `specializations` (`[]` when blank), `primaryOrgName` = host university (enables name+org resolution + sets primary org). `orcid`/`openalexAuthorId` null. |

Deliberately dropped in V1 (no field on `ProjectUpsert`; reported in the ingest
summary, not silently dropped): `thematic_areas`, `ace_phase`. Possible follow-up
if a themes/tags column is added. No PI is asserted (`pi: null`) — the factsheets
don't reliably identify centre directors, so every expert is an `investigator`.

## Entity-resolution behaviour

- Projects dedup by `lower(title)`. No overlap with seeded consortia → clean.
- People resolve by ORCID → OpenAlex → name+primaryOrg (conf 0.7). ACE faculty have
  no strong keys, so intra-ACE same-name+same-org faculty merge; cross-programme
  unification for the general population happens later via OpenAlex enrichment. The
  curated seed (Awandare, with ORCID) remains authoritative for the hero. This matches
  the existing RePORTER adapters' behaviour.

## Mechanism (follows the h3africa/reporter pattern)

1. **One-off extraction script** `apps/api/src/ingest/scripts/extract-ace-fixture.mts`
   parses the old `seed.sql` → committed fixture
   `apps/api/src/ingest/__fixtures__/ace.factsheets.json`:
   ```json
   { "centres": [ { "name", "short_name", "host_university", "country",
                    "website", "thematic_areas": [], "ace_phase",
                    "experts": [ { "full_name", "title", "specializations": [] } ] } ] }
   ```
   The fixture is the source of truth the adapter reads — no live dependency on the
   old DB. The script is committed for reproducibility.
2. **`ace-normalize.ts`** — `export function parseAce(jsonText: string): ProjectUpsert[]`
   (pure, unit-tested).
3. **`ace.ts`** — `export const aceAdapter: Adapter` (`name: "ace"`,
   `SOURCE = { source: "world-bank-ace", ingestMethod: "manual" }`), loops
   `upsertProject`, returns `IngestSummary`.
4. **`ace-normalize.test.ts`** — asserts: ~41 projects; every `programName ===
   "Africa Centres of Excellence"`; lead-org title-casing; World Bank funder partner
   present on every project; a known centre (e.g. CDA) has its experts as
   `investigator` members; a blank-specialization expert yields `[]`.
5. Register `ace: () => import("./ace.js")` in `runner.ts`. Run: `pnpm ingest ace`.

## Success criteria

- `pnpm --filter @app/api test` passes including the new normalize test.
- `pnpm ingest ace` upserts ~41 projects under the existing ACE programme with their
  lead orgs, World Bank/AAU partners, and faculty members; re-running is idempotent.
