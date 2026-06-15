# OpenAlex Ingest Adapter + Hero Consortium Seed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the empty Directory database with real, resolvable data from OpenAlex (people + organisations + funding) plus a hand-curated consortium fixture, so the cross-consortium people feature works end-to-end on real names.

**Architecture:** A new `apps/api/src/ingest/` module. Pure `normalize*` functions translate OpenAlex JSON into our row shapes (unit-tested). An idempotent `upsert` layer writes them by find-then-update-or-insert on natural keys (orcid / openalex_author_id / ror_id), resolving people inline. A `runner` CLI drives named adapters: `openalex` (live, network) and `seed-consortia` (offline JSON, supplies the programme→consortium→membership tier OpenAlex cannot model). Publications stay background-only: works are read transiently to derive a per-person activity signal; no `publications` rows are written.

**Tech Stack:** TypeScript (ESM, `.js` import suffixes), Drizzle ORM on postgres-js, `tsx` runner, Node's built-in `node:test` for unit tests (no new test-framework dependency), bash + psql for the existing end-to-end smoke test.

---

## File structure

| File | Responsibility |
|------|----------------|
| `supabase/migrations/0002_person_activity_signal.sql` | **Create.** Add `works_count`, `last_active_year` to `people` (canonical hand-authored migration). |
| `apps/api/src/db/schema.ts` | **Modify.** Add the two columns to the Drizzle `people` table. |
| `packages/types/src/people.ts` | **Modify.** Add `works_count`, `last_active_year` to the `Person` interface. |
| `packages/types/src/projects.ts` | **Modify.** Tighten comment to "consortium node". |
| `apps/api/src/serializers.ts` | **Modify.** Map the two new fields in `toPerson`. |
| `apps/api/src/ingest/types.ts` | **Create.** `Adapter` interface + upsert record shapes. |
| `apps/api/src/ingest/openalex-normalize.ts` | **Create.** Pure functions: OpenAlex JSON → record shapes. |
| `apps/api/src/ingest/openalex-normalize.test.ts` | **Create.** `node:test` unit tests over saved fixtures. |
| `apps/api/src/ingest/__fixtures__/author.json` | **Create.** Saved sample OpenAlex author response. |
| `apps/api/src/ingest/__fixtures__/works.json` | **Create.** Saved sample OpenAlex works response. |
| `apps/api/src/ingest/http.ts` | **Create.** OpenAlex client: polite pool, cursor pagination, backoff. |
| `apps/api/src/ingest/upsert.ts` | **Create.** Idempotent find-then-upsert + inline person resolution. |
| `apps/api/src/ingest/openalex.ts` | **Create.** The OpenAlex adapter (fetch → normalize → upsert). |
| `apps/api/src/ingest/seed-consortia.ts` | **Create.** Offline fixture adapter (programmes/consortia/members). |
| `apps/api/src/ingest/seeds/institutions.ror.json` | **Create.** ~10–15 institution ROR ids. |
| `apps/api/src/ingest/seeds/people.orcid.json` | **Create.** Hero ORCIDs. |
| `apps/api/src/ingest/seeds/consortia.json` | **Create.** The hero programme→consortium→membership fixture. |
| `apps/api/src/ingest/runner.ts` | **Create.** CLI dispatching adapters by name. |
| `apps/api/package.json` | **Modify.** Add `ingest` and `test` scripts. |
| `apps/api/test/smoke.sh` | **Modify.** Apply 0002, run seed adapter, assert cross-programme span. |

**Key design decisions locked in code:**
- Upsert is **find-by-natural-key then update-or-insert in code** (a single-threaded ingest run, so no `ON CONFLICT` and no new unique indexes needed beyond the existing partial uniques on `people.orcid` / `people.openalex_author_id`).
- OpenAlex **funders** map to `organizations` with `org_type = 'funder'` (+ a `grants` row), keyed by lower(name). **Programmes** (ACE/H3Africa/DELTAS) come *only* from the consortium fixture, never from OpenAlex.
- Funder/grant extraction reads a capped set of works and is run **only for the hero ORCID authors** (a small set), to avoid an N+1 across every institution author. The cap is logged, never silent.

---

## Task 1: Migration + schema + types for the person activity signal

**Files:**
- Create: `supabase/migrations/0002_person_activity_signal.sql`
- Modify: `apps/api/src/db/schema.ts` (the `people` table)
- Modify: `packages/types/src/people.ts`
- Modify: `packages/types/src/projects.ts`
- Modify: `apps/api/src/serializers.ts` (`toPerson`)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0002_person_activity_signal.sql`:

```sql
-- 0002: per-person activity signal derived from OpenAlex works.
-- Publications stay background-only; we keep only a lightweight signal on people.
alter table public.people add column if not exists works_count      integer;
alter table public.people add column if not exists last_active_year integer;
```

- [ ] **Step 2: Apply it to a scratch DB to verify it parses**

Run:
```bash
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
psql -h localhost -p 5432 -d postgres -X -q -c "drop database if exists ra_migtest;"
psql -h localhost -p 5432 -d postgres -X -q -c "create database ra_migtest;"
psql -h localhost -p 5432 -d ra_migtest -v ON_ERROR_STOP=1 -X -q -f supabase/migrations/0001_init.sql
psql -h localhost -p 5432 -d ra_migtest -v ON_ERROR_STOP=1 -X -q -f supabase/migrations/0002_person_activity_signal.sql && echo "0002 OK"
psql -h localhost -p 5432 -d postgres -X -q -c "drop database if exists ra_migtest;"
```
Expected: `0002 OK` with no errors.

- [ ] **Step 3: Add the columns to the Drizzle schema**

In `apps/api/src/db/schema.ts`, in the `people` table, add after `mergedInto`:

```ts
  worksCount: integer("works_count"),
  lastActiveYear: integer("last_active_year"),
```

(`integer` is already imported at the top of the file.)

- [ ] **Step 4: Add the fields to the shared Person type**

In `packages/types/src/people.ts`, add to the `Person` interface after `merged_into`:

```ts
  works_count: number | null;
  last_active_year: number | null;
```

- [ ] **Step 5: Map the fields in the serializer**

In `apps/api/src/serializers.ts`, inside `toPerson`'s returned object, add after `openalex_author_id: r.openalexAuthorId,`:

```ts
    works_count: r.worksCount,
    last_active_year: r.lastActiveYear,
```

- [ ] **Step 6: Tighten the projects comment**

In `packages/types/src/projects.ts`, change the first comment line to:

```ts
/** Project — a consortium node (funded project / hub) under a programme. */
```

- [ ] **Step 7: Typecheck the workspace**

Run: `pnpm build:types && pnpm --filter @research-atlas/api typecheck`
Expected: exits 0, no type errors.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0002_person_activity_signal.sql apps/api/src/db/schema.ts packages/types/src/people.ts packages/types/src/projects.ts apps/api/src/serializers.ts
git commit -m "feat(ingest): add per-person activity signal columns"
```

---

## Task 2: Ingest types — Adapter interface + record shapes

**Files:**
- Create: `apps/api/src/ingest/types.ts`

- [ ] **Step 1: Write the types**

Create `apps/api/src/ingest/types.ts`:

```ts
/**
 * Shared contracts for ingest adapters. An adapter pulls from one source and
 * writes through the upsert layer; the runner only knows this interface.
 */
export interface Adapter {
  /** Stable name used on the CLI: `pnpm ingest <name>`. */
  name: string;
  /** Fetch → normalize → upsert. Returns a summary for the runner to print. */
  run(): Promise<IngestSummary>;
}

/** Per-table counts plus anything skipped/capped (no silent truncation). */
export interface IngestSummary {
  upserts: Record<string, number>;
  skipped: string[];
}

/** Normalized organisation ready to upsert (institution or funder). */
export interface OrgUpsert {
  name: string;
  shortName: string | null;
  orgType: "university" | "research_centre" | "institute" | "funder";
  country: string | null;
  website: string | null;
  rorId: string | null;
  sourceUrl: string;
}

/** Normalized person ready to upsert (resolution keys carried). */
export interface PersonUpsert {
  fullName: string;
  orcid: string | null;
  openalexAuthorId: string | null;
  specializations: string[];
  worksCount: number | null;
  lastActiveYear: number | null;
  /** ROR of the person's primary institution, resolved to an org at upsert. */
  primaryOrgRor: string | null;
  sourceUrl: string;
}

/** Normalized grant + its funder org. */
export interface GrantUpsert {
  name: string;
  awardNumber: string | null;
  funder: OrgUpsert;
  sourceUrl: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @research-atlas/api typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/ingest/types.ts
git commit -m "feat(ingest): adapter interface and upsert record shapes"
```

---

## Task 3: Normalize an OpenAlex author → PersonUpsert (TDD)

**Files:**
- Create: `apps/api/src/ingest/__fixtures__/author.json`
- Create: `apps/api/src/ingest/openalex-normalize.ts`
- Test: `apps/api/src/ingest/openalex-normalize.test.ts`

- [ ] **Step 1: Save a representative author fixture**

Create `apps/api/src/ingest/__fixtures__/author.json` (trimmed to the fields we read):

```json
{
  "id": "https://openalex.org/A5023888391",
  "orcid": "https://orcid.org/0000-0002-8793-3641",
  "display_name": "Gordon A. Awandare",
  "works_count": 142,
  "counts_by_year": [
    { "year": 2024, "works_count": 9 },
    { "year": 2023, "works_count": 12 },
    { "year": 2019, "works_count": 0 }
  ],
  "last_known_institutions": [
    {
      "id": "https://openalex.org/I154526488",
      "ror": "https://ror.org/01rxfrp27",
      "display_name": "University of Ghana"
    }
  ],
  "x_concepts": [
    { "display_name": "Malaria", "score": 88.1 },
    { "display_name": "Genomics", "score": 71.4 },
    { "display_name": "Immunology", "score": 60.2 },
    { "display_name": "Biology", "score": 41.0 }
  ]
}
```

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/ingest/openalex-normalize.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeAuthor } from "./openalex-normalize.js";

const author = JSON.parse(
  readFileSync(fileURLToPath(new URL("./__fixtures__/author.json", import.meta.url)), "utf8"),
);

test("normalizeAuthor extracts bare ids, activity signal, and themes", () => {
  const p = normalizeAuthor(author);
  assert.equal(p.fullName, "Gordon A. Awandare");
  assert.equal(p.orcid, "0000-0002-8793-3641"); // bare, not the URL
  assert.equal(p.openalexAuthorId, "A5023888391"); // bare id
  assert.equal(p.worksCount, 142);
  assert.equal(p.lastActiveYear, 2024); // max year with works_count > 0
  assert.equal(p.primaryOrgRor, "01rxfrp27"); // bare ROR
  assert.deepEqual(p.specializations, ["Malaria", "Genomics", "Immunology"]); // top 3
  assert.equal(p.sourceUrl, "https://openalex.org/A5023888391");
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd apps/api && node --import tsx --test src/ingest/openalex-normalize.test.ts`
Expected: FAIL — cannot find module `./openalex-normalize.js` / `normalizeAuthor is not a function`.

- [ ] **Step 4: Implement `normalizeAuthor`**

Create `apps/api/src/ingest/openalex-normalize.ts`:

```ts
import type { PersonUpsert } from "./types.js";

/** Strip an OpenAlex/ORCID/ROR URL down to its bare id. */
function bareId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.trim().replace(/\/+$/, "").split("/").pop();
  return m && m.length > 0 ? m : null;
}

interface OAAuthor {
  id: string;
  orcid: string | null;
  display_name: string;
  works_count?: number;
  counts_by_year?: { year: number; works_count: number }[];
  last_known_institutions?: { ror?: string | null }[];
  x_concepts?: { display_name: string; score: number }[];
}

export function normalizeAuthor(a: OAAuthor): PersonUpsert {
  const activeYears = (a.counts_by_year ?? [])
    .filter((c) => c.works_count > 0)
    .map((c) => c.year);
  const themes = (a.x_concepts ?? [])
    .slice()
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map((c) => c.display_name);
  return {
    fullName: a.display_name,
    orcid: bareId(a.orcid),
    openalexAuthorId: bareId(a.id),
    specializations: themes,
    worksCount: a.works_count ?? null,
    lastActiveYear: activeYears.length ? Math.max(...activeYears) : null,
    primaryOrgRor: bareId(a.last_known_institutions?.[0]?.ror ?? null),
    sourceUrl: a.id,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/api && node --import tsx --test src/ingest/openalex-normalize.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ingest/openalex-normalize.ts apps/api/src/ingest/openalex-normalize.test.ts apps/api/src/ingest/__fixtures__/author.json
git commit -m "feat(ingest): normalize OpenAlex author to person upsert"
```

---

## Task 4: Normalize an OpenAlex institution → OrgUpsert (TDD)

**Files:**
- Modify: `apps/api/src/ingest/openalex-normalize.ts`
- Modify: `apps/api/src/ingest/openalex-normalize.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/ingest/openalex-normalize.test.ts`:

```ts
import { normalizeInstitution } from "./openalex-normalize.js";

test("normalizeInstitution maps an institution to a university org", () => {
  const org = normalizeInstitution({
    id: "https://openalex.org/I154526488",
    ror: "https://ror.org/01rxfrp27",
    display_name: "University of Ghana",
    country_code: "GH",
    homepage_url: "https://www.ug.edu.gh",
  });
  assert.equal(org.name, "University of Ghana");
  assert.equal(org.orgType, "university");
  assert.equal(org.rorId, "01rxfrp27");
  assert.equal(org.country, "GH");
  assert.equal(org.website, "https://www.ug.edu.gh");
  assert.equal(org.sourceUrl, "https://openalex.org/I154526488");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && node --import tsx --test src/ingest/openalex-normalize.test.ts`
Expected: FAIL — `normalizeInstitution is not a function`.

- [ ] **Step 3: Implement `normalizeInstitution`**

Append to `apps/api/src/ingest/openalex-normalize.ts`:

```ts
import type { OrgUpsert } from "./types.js";

interface OAInstitution {
  id: string;
  ror?: string | null;
  display_name: string;
  country_code?: string | null;
  homepage_url?: string | null;
}

export function normalizeInstitution(i: OAInstitution): OrgUpsert {
  return {
    name: i.display_name,
    shortName: null,
    orgType: "university",
    country: i.country_code ?? null,
    website: i.homepage_url ?? null,
    rorId: bareId(i.ror ?? null),
    sourceUrl: i.id,
  };
}
```

(Update the existing `import type { PersonUpsert }` line to `import type { OrgUpsert, PersonUpsert } from "./types.js";` and remove the duplicate import added above.)

- [ ] **Step 4: Run to verify both tests pass**

Run: `cd apps/api && node --import tsx --test src/ingest/openalex-normalize.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ingest/openalex-normalize.ts apps/api/src/ingest/openalex-normalize.test.ts
git commit -m "feat(ingest): normalize OpenAlex institution to org upsert"
```

---

## Task 5: Normalize OpenAlex works → funder orgs + grants (TDD)

**Files:**
- Create: `apps/api/src/ingest/__fixtures__/works.json`
- Modify: `apps/api/src/ingest/openalex-normalize.ts`
- Modify: `apps/api/src/ingest/openalex-normalize.test.ts`

- [ ] **Step 1: Save a representative works fixture**

Create `apps/api/src/ingest/__fixtures__/works.json` (an OpenAlex `/works` page, trimmed):

```json
{
  "results": [
    {
      "id": "https://openalex.org/W111",
      "grants": [
        { "funder": "https://openalex.org/F4320332161", "funder_display_name": "Wellcome Trust", "award_id": "107755/Z/15/Z" },
        { "funder": "https://openalex.org/F4320306076", "funder_display_name": "NIH", "award_id": null }
      ]
    },
    {
      "id": "https://openalex.org/W222",
      "grants": [
        { "funder": "https://openalex.org/F4320332161", "funder_display_name": "Wellcome Trust", "award_id": "107755/Z/15/Z" }
      ]
    },
    { "id": "https://openalex.org/W333", "grants": [] }
  ]
}
```

- [ ] **Step 2: Write the failing test**

Append to `apps/api/src/ingest/openalex-normalize.test.ts`:

```ts
import { normalizeGrants } from "./openalex-normalize.js";

test("normalizeGrants dedupes funder+award across works", () => {
  const grants = normalizeGrants(works.results);
  // Wellcome (107755/Z/15/Z) appears twice → one grant; NIH (no award) → one grant.
  assert.equal(grants.length, 2);
  const wellcome = grants.find((g) => g.funder.name === "Wellcome Trust");
  assert.ok(wellcome);
  assert.equal(wellcome.awardNumber, "107755/Z/15/Z");
  assert.equal(wellcome.funder.orgType, "funder");
});
```

And add this near the top of the test file (next to the `author` fixture load):

```ts
const works = JSON.parse(
  readFileSync(fileURLToPath(new URL("./__fixtures__/works.json", import.meta.url)), "utf8"),
);
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/api && node --import tsx --test src/ingest/openalex-normalize.test.ts`
Expected: FAIL — `normalizeGrants is not a function`.

- [ ] **Step 4: Implement `normalizeGrants`**

Append to `apps/api/src/ingest/openalex-normalize.ts`:

```ts
import type { GrantUpsert } from "./types.js";

interface OAWork {
  id: string;
  grants?: { funder: string; funder_display_name: string; award_id: string | null }[];
}

export function normalizeGrants(works: OAWork[]): GrantUpsert[] {
  const byKey = new Map<string, GrantUpsert>();
  for (const w of works) {
    for (const g of w.grants ?? []) {
      const key = `${g.funder_display_name.toLowerCase()}|${g.award_id ?? ""}`;
      if (byKey.has(key)) continue;
      byKey.set(key, {
        name: g.award_id ? `${g.funder_display_name} ${g.award_id}` : g.funder_display_name,
        awardNumber: g.award_id,
        funder: {
          name: g.funder_display_name,
          shortName: null,
          orgType: "funder",
          country: null,
          website: null,
          rorId: null,
          sourceUrl: w.id,
        },
        sourceUrl: w.id,
      });
    }
  }
  return [...byKey.values()];
}
```

(Merge the new `import type { GrantUpsert }` into the existing types import line.)

- [ ] **Step 5: Run to verify all three tests pass**

Run: `cd apps/api && node --import tsx --test src/ingest/openalex-normalize.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ingest/openalex-normalize.ts apps/api/src/ingest/openalex-normalize.test.ts apps/api/src/ingest/__fixtures__/works.json
git commit -m "feat(ingest): normalize OpenAlex works to funder grants"
```

---

## Task 6: OpenAlex HTTP client (polite pool, cursor pagination, backoff)

**Files:**
- Create: `apps/api/src/ingest/http.ts`
- Modify: `apps/api/src/env.ts` (add an optional contact email)
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Add the polite-pool email to env**

In `apps/api/src/env.ts`, add to the exported `env` object (after `webOrigins`):

```ts
  openalexMailto: process.env.OPENALEX_MAILTO ?? "",
```

In `apps/api/.env.example`, add at the end:

```
# OpenAlex "polite pool" contact — recommended for faster, more reliable ingest.
OPENALEX_MAILTO=
```

- [ ] **Step 2: Implement the client**

Create `apps/api/src/ingest/http.ts`:

```ts
import { env } from "../env.js";

const BASE = "https://api.openalex.org";

/** GET one OpenAlex resource by path, with polite-pool mailto + retry/backoff. */
export async function oaGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}/${path.replace(/^\/+/, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (env.openalexMailto) url.searchParams.set("mailto", env.openalexMailto);

  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "research-atlas-ingest" } });
      if (res.status === 429 || res.status >= 500) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new Error(`OpenAlex ${res.status} for ${url.pathname}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw new Error(`OpenAlex request failed after retries: ${url.href} (${String(lastErr)})`);
}

/** Page through a list endpoint with cursor pagination, up to `cap` items. */
export async function oaPaginate<T>(
  path: string,
  filter: string,
  cap: number,
): Promise<T[]> {
  const out: T[] = [];
  let cursor = "*";
  while (out.length < cap && cursor) {
    const page = await oaGet<{ results: T[]; meta: { next_cursor: string | null } }>(path, {
      filter,
      "per-page": "200",
      cursor,
    });
    out.push(...page.results);
    cursor = page.meta.next_cursor ?? "";
  }
  return out.slice(0, cap);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @research-atlas/api typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ingest/http.ts apps/api/src/env.ts apps/api/.env.example
git commit -m "feat(ingest): OpenAlex HTTP client with polite pool and backoff"
```

---

## Task 7: Idempotent upsert layer + inline person resolution

**Files:**
- Create: `apps/api/src/ingest/upsert.ts`

This layer is verified end-to-end by the smoke test (Task 11) rather than a unit test, because it touches the database. Keep each function a single find-then-update-or-insert.

- [ ] **Step 1: Implement the upserts**

Create `apps/api/src/ingest/upsert.ts`:

```ts
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { grants, organizations, people } from "../db/schema.js";
import type { GrantUpsert, OrgUpsert, PersonUpsert } from "./types.js";

const prov = (sourceUrl: string) => ({
  source: "openalex",
  sourceUrl,
  ingestMethod: "api" as const,
  ingestedAt: new Date(),
  verificationStatus: "ingested_unverified" as const,
});

/** Upsert an org by ror_id when present, else by lower(name). Returns its id. */
export async function upsertOrg(o: OrgUpsert): Promise<string> {
  const existing = o.rorId
    ? await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.rorId, o.rorId)).limit(1)
    : await db.select({ id: organizations.id }).from(organizations).where(sql`lower(name) = lower(${o.name})`).limit(1);

  const values = {
    name: o.name,
    shortName: o.shortName,
    orgType: o.orgType,
    country: o.country,
    website: o.website,
    rorId: o.rorId,
    updatedAt: new Date(),
    ...prov(o.sourceUrl),
  };
  if (existing[0]) {
    await db.update(organizations).set(values).where(eq(organizations.id, existing[0].id));
    return existing[0].id;
  }
  const [row] = await db.insert(organizations).values(values).returning({ id: organizations.id });
  return row.id;
}

/**
 * Upsert a person, resolving by orcid then openalex_author_id (the partial
 * unique keys). Links primary_org_id when the primary ROR resolves to an org.
 */
export async function upsertPerson(p: PersonUpsert): Promise<string> {
  let primaryOrgId: string | null = null;
  if (p.primaryOrgRor) {
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.rorId, p.primaryOrgRor)).limit(1);
    primaryOrgId = org?.id ?? null;
  }

  const found = p.orcid
    ? await db.select({ id: people.id }).from(people).where(eq(people.orcid, p.orcid)).limit(1)
    : p.openalexAuthorId
      ? await db.select({ id: people.id }).from(people).where(eq(people.openalexAuthorId, p.openalexAuthorId)).limit(1)
      : [];

  const values = {
    fullName: p.fullName,
    normalisedName: p.fullName.toLowerCase().trim(),
    specializations: p.specializations,
    orcid: p.orcid,
    openalexAuthorId: p.openalexAuthorId,
    worksCount: p.worksCount,
    lastActiveYear: p.lastActiveYear,
    primaryOrgId,
    ...prov(p.sourceUrl),
  };
  if (found[0]) {
    await db.update(people).set(values).where(eq(people.id, found[0].id));
    return found[0].id;
  }
  const [row] = await db.insert(people).values(values).returning({ id: people.id });
  return row.id;
}

/** Upsert a grant (and its funder org) keyed by funder name + award number. */
export async function upsertGrant(g: GrantUpsert): Promise<void> {
  const funderOrgId = await upsertOrg(g.funder);
  const existing = await db
    .select({ id: grants.id })
    .from(grants)
    .where(sql`lower(name) = lower(${g.name})`)
    .limit(1);
  const values = {
    name: g.name,
    funderOrgId,
    awardNumber: g.awardNumber,
    ...prov(g.sourceUrl),
  };
  if (existing[0]) {
    await db.update(grants).set(values).where(eq(grants.id, existing[0].id));
    return;
  }
  await db.insert(grants).values(values);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @research-atlas/api typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/ingest/upsert.ts
git commit -m "feat(ingest): idempotent upsert layer with inline person resolution"
```

---

## Task 8: The OpenAlex adapter (fetch → normalize → upsert)

**Files:**
- Create: `apps/api/src/ingest/seeds/institutions.ror.json`
- Create: `apps/api/src/ingest/seeds/people.orcid.json`
- Create: `apps/api/src/ingest/openalex.ts`

- [ ] **Step 1: Create the seed lists**

Create `apps/api/src/ingest/seeds/institutions.ror.json` (start with a handful; raise later):

```json
[
  "https://ror.org/01rxfrp27",
  "https://ror.org/03xb08129",
  "https://ror.org/00v82db78",
  "https://ror.org/0072hbn54"
]
```

Create `apps/api/src/ingest/seeds/people.orcid.json`:

```json
[
  "0000-0002-8793-3641"
]
```

- [ ] **Step 2: Implement the adapter**

Create `apps/api/src/ingest/openalex.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { oaGet, oaPaginate } from "./http.js";
import { normalizeAuthor, normalizeGrants, normalizeInstitution } from "./openalex-normalize.js";
import { upsertGrant, upsertOrg, upsertPerson } from "./upsert.js";
import type { Adapter, IngestSummary } from "./types.js";

const WORKS_CAP = Number(process.env.INGEST_WORKS_CAP ?? 200);
const AUTHORS_CAP = Number(process.env.INGEST_AUTHORS_CAP ?? 200);

function seed<T>(file: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./seeds/${file}`, import.meta.url)), "utf8")) as T;
}
const bareId = (url: string) => url.replace(/\/+$/, "").split("/").pop()!;

export const openalexAdapter: Adapter = {
  name: "openalex",
  async run(): Promise<IngestSummary> {
    const summary: IngestSummary = { upserts: { organizations: 0, people: 0, grants: 0 }, skipped: [] };
    const rors = seed<string[]>("institutions.ror.json");
    const orcids = seed<string[]>("people.orcid.json");

    // 1. Institutions → orgs, then their authors → people.
    for (const rorUrl of rors) {
      try {
        const inst = await oaGet<Record<string, unknown>>(`institutions/ror:${bareId(rorUrl)}`);
        await upsertOrg(normalizeInstitution(inst as never));
        summary.upserts.organizations++;

        const authors = await oaPaginate<Record<string, unknown>>(
          "authors",
          `affiliations.institution.id:${(inst as { id: string }).id}`,
          AUTHORS_CAP,
        );
        for (const a of authors) {
          await upsertPerson(normalizeAuthor(a as never));
          summary.upserts.people++;
        }
        if (authors.length === AUTHORS_CAP) summary.skipped.push(`authors capped at ${AUTHORS_CAP} for ${rorUrl}`);
      } catch (err) {
        summary.skipped.push(`institution ${rorUrl}: ${String(err)}`);
      }
    }

    // 2. Hero ORCIDs → people (+ their funders/grants, capped). Small set only.
    for (const orcid of orcids) {
      try {
        const author = await oaGet<{ id: string }>(`authors/orcid:${orcid}`);
        const personId = await upsertPerson(normalizeAuthor(author as never));
        if (personId) summary.upserts.people++;

        const works = await oaPaginate<Record<string, unknown>>("works", `author.id:${author.id}`, WORKS_CAP);
        for (const g of normalizeGrants(works as never)) {
          await upsertGrant(g);
          summary.upserts.grants++;
        }
        if (works.length === WORKS_CAP) summary.skipped.push(`works capped at ${WORKS_CAP} for ${orcid}`);
      } catch (err) {
        summary.skipped.push(`orcid ${orcid}: ${String(err)}`);
      }
    }
    return summary;
  },
};
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @research-atlas/api typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ingest/openalex.ts apps/api/src/ingest/seeds/institutions.ror.json apps/api/src/ingest/seeds/people.orcid.json
git commit -m "feat(ingest): OpenAlex adapter wiring fetch-normalize-upsert"
```

---

## Task 9: Consortium seed adapter (the hero programme→consortium→membership tier)

**Files:**
- Create: `apps/api/src/ingest/seeds/consortia.json`
- Create: `apps/api/src/ingest/seed-consortia.ts`

- [ ] **Step 1: Author the consortium fixture**

Create `apps/api/src/ingest/seeds/consortia.json`. Keys link the rows together; every row carries a real `source_url`.

```json
{
  "programmes": [
    { "key": "ace", "name": "Africa Centres of Excellence", "short_name": "ACE", "source_url": "https://ace.aau.org" },
    { "key": "h3africa", "name": "Human Heredity and Health in Africa", "short_name": "H3Africa", "source_url": "https://h3africa.org" },
    { "key": "deltas", "name": "DELTAS Africa", "short_name": "DELTAS", "source_url": "https://www.aasciences.africa/deltas" }
  ],
  "consortia": [
    { "key": "waccbip", "title": "West African Centre for Cell Biology of Infectious Pathogens", "programme": "ace", "country": "Ghana", "source_url": "https://waccbip.org" },
    { "key": "sicklegen", "title": "SickleGenAfrica", "programme": "h3africa", "country": "Ghana", "source_url": "https://h3africa.org/index.php/consortium/sicklegenafrica" },
    { "key": "deltas-wac", "title": "Awandare DELTAS Fellowship", "programme": "deltas", "country": "Ghana", "source_url": "https://www.aasciences.africa/deltas" }
  ],
  "people": [
    { "key": "awandare", "full_name": "Gordon Awandare", "orcid": "0000-0002-8793-3641", "source_url": "https://waccbip.org/team/gordon-awandare" }
  ],
  "memberships": [
    { "person": "awandare", "consortium": "waccbip", "role": "pi" },
    { "person": "awandare", "consortium": "sicklegen", "role": "co_pi" },
    { "person": "awandare", "consortium": "deltas-wac", "role": "pi" }
  ]
}
```

- [ ] **Step 2: Implement the seed adapter**

Create `apps/api/src/ingest/seed-consortia.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { people, programs, projectMembers, projects } from "../db/schema.js";
import type { Adapter, IngestSummary } from "./types.js";

interface Fixture {
  programmes: { key: string; name: string; short_name: string; source_url: string }[];
  consortia: { key: string; title: string; programme: string; country: string; source_url: string }[];
  people: { key: string; full_name: string; orcid: string; source_url: string }[];
  memberships: { person: string; consortium: string; role: string }[];
}

const prov = (sourceUrl: string) => ({
  source: "curated",
  sourceUrl,
  ingestMethod: "manual" as const,
  ingestedAt: new Date(),
  verificationStatus: "ingested_unverified" as const,
});

export const seedConsortiaAdapter: Adapter = {
  name: "seed-consortia",
  async run(): Promise<IngestSummary> {
    const fx = JSON.parse(
      readFileSync(fileURLToPath(new URL("./seeds/consortia.json", import.meta.url)), "utf8"),
    ) as Fixture;
    const summary: IngestSummary = { upserts: { programs: 0, projects: 0, people: 0, project_members: 0 }, skipped: [] };

    const progId = new Map<string, string>();
    for (const p of fx.programmes) {
      const [existing] = await db.select({ id: programs.id }).from(programs).where(sql`lower(name) = lower(${p.name})`).limit(1);
      const values = { name: p.name, shortName: p.short_name, ...prov(p.source_url) };
      const id = existing
        ? (await db.update(programs).set(values).where(eq(programs.id, existing.id)), existing.id)
        : (await db.insert(programs).values(values).returning({ id: programs.id }))[0].id;
      progId.set(p.key, id);
      summary.upserts.programs++;
    }

    const projId = new Map<string, string>();
    for (const c of fx.consortia) {
      const [existing] = await db.select({ id: projects.id }).from(projects).where(sql`lower(title) = lower(${c.title})`).limit(1);
      const values = { title: c.title, programId: progId.get(c.programme) ?? null, country: c.country, ...prov(c.source_url) };
      const id = existing
        ? (await db.update(projects).set(values).where(eq(projects.id, existing.id)), existing.id)
        : (await db.insert(projects).values(values).returning({ id: projects.id }))[0].id;
      projId.set(c.key, id);
      summary.upserts.projects++;
    }

    const personId = new Map<string, string>();
    for (const p of fx.people) {
      const [existing] = await db.select({ id: people.id }).from(people).where(eq(people.orcid, p.orcid)).limit(1);
      const values = { fullName: p.full_name, normalisedName: p.full_name.toLowerCase().trim(), orcid: p.orcid, ...prov(p.source_url) };
      const id = existing
        ? (await db.update(people).set(values).where(eq(people.id, existing.id)), existing.id)
        : (await db.insert(people).values(values).returning({ id: people.id }))[0].id;
      personId.set(p.key, id);
      summary.upserts.people++;
    }

    for (const m of fx.memberships) {
      const pid = projId.get(m.consortium);
      const persId = personId.get(m.person);
      if (!pid || !persId) { summary.skipped.push(`membership ${m.person}->${m.consortium}: unresolved key`); continue; }
      const [existing] = await db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(sql`project_id = ${pid} and person_id = ${persId} and role = ${m.role}`)
        .limit(1);
      if (!existing) {
        await db.insert(projectMembers).values({ projectId: pid, personId: persId, role: m.role as never, ...prov("https://waccbip.org") });
      }
      summary.upserts.project_members++;
    }
    return summary;
  },
};
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @research-atlas/api typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ingest/seed-consortia.ts apps/api/src/ingest/seeds/consortia.json
git commit -m "feat(ingest): hero consortium seed adapter"
```

---

## Task 10: Runner CLI + package scripts

**Files:**
- Create: `apps/api/src/ingest/runner.ts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Implement the runner**

Create `apps/api/src/ingest/runner.ts`:

```ts
import { openalexAdapter } from "./openalex.js";
import { seedConsortiaAdapter } from "./seed-consortia.js";
import type { Adapter } from "./types.js";

const adapters: Record<string, Adapter> = {
  [openalexAdapter.name]: openalexAdapter,
  [seedConsortiaAdapter.name]: seedConsortiaAdapter,
};

async function main(): Promise<void> {
  const name = process.argv[2];
  const adapter = name ? adapters[name] : undefined;
  if (!adapter) {
    console.error(`Usage: pnpm ingest <${Object.keys(adapters).join("|")}>`);
    process.exit(1);
  }
  console.log(`[ingest] running "${adapter.name}"…`);
  const summary = await adapter.run();
  console.log(`[ingest] upserts: ${JSON.stringify(summary.upserts)}`);
  if (summary.skipped.length) console.log(`[ingest] skipped/capped:\n  ${summary.skipped.join("\n  ")}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[ingest] failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the scripts**

In `apps/api/package.json`, add to `"scripts"`:

```json
    "ingest": "tsx src/ingest/runner.ts",
    "test": "node --import tsx --test 'src/**/*.test.ts'"
```

- [ ] **Step 3: Run the unit tests via the new script**

Run: `pnpm --filter @research-atlas/api test`
Expected: PASS (3 tests from `openalex-normalize.test.ts`).

- [ ] **Step 4: Verify the runner rejects an unknown adapter**

Run: `cd apps/api && pnpm ingest bogus; echo "exit=$?"`
Expected: prints the usage line and `exit=1`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ingest/runner.ts apps/api/package.json
git commit -m "feat(ingest): runner CLI and ingest/test scripts"
```

---

## Task 11: Extend the smoke test — apply 0002, seed consortia, assert cross-programme span

**Files:**
- Modify: `apps/api/test/smoke.sh`

- [ ] **Step 1: Apply migration 0002 in the smoke setup**

In `apps/api/test/smoke.sh`, immediately after the line that applies `0001_init.sql`, add:

```bash
psql -h localhost -p 5432 -d $DB -v ON_ERROR_STOP=1 -X -q -f "$ROOT/supabase/migrations/0002_person_activity_signal.sql" >/dev/null
```

- [ ] **Step 2: Run the consortium seed adapter against the test DB**

In `smoke.sh`, after the existing inline `insert into …` block and before `cd "$API"`, add:

```bash
# Seed the hero programme→consortium→membership tier through the real adapter.
( cd "$API" && DATABASE_URL="postgres://$(whoami)@localhost:5432/$DB" pnpm ingest seed-consortia >/dev/null )
```

- [ ] **Step 3: Add the cross-programme hero assertions**

In `smoke.sh`, after the existing hero assertions block (the `project→members` line), add:

```bash
# Real hero check: the orcid-resolved person spans ≥2 programmes via consortia.
HERO_ID=$(psql -h localhost -p 5432 -d $DB -tAc "select id from people where orcid='0000-0002-8793-3641'")
HEROJSON=$(curl -s "$BASE/people/$HERO_ID/projects")
ck "hero person spans WACCBIP" 1 "$(echo "$HEROJSON" | grep -c 'WACCBIP')"
ck "hero person spans SickleGenAfrica" 1 "$(echo "$HEROJSON" | grep -c 'SickleGenAfrica')"
```

- [ ] **Step 4: Run the full smoke test**

Run: `bash apps/api/test/smoke.sh`
Expected: `### Result: N passed, 0 failed` — including the two new hero assertions. (Requires local Postgres.app running on :5432.)

- [ ] **Step 5: Commit**

```bash
git add apps/api/test/smoke.sh
git commit -m "test(ingest): smoke covers cross-programme hero span via seed adapter"
```

---

## Task 12: Full verification + optional live OpenAlex run

**Files:** none (verification only).

- [ ] **Step 1: Build and typecheck the whole workspace**

Run: `pnpm -r build && pnpm -r typecheck`
Expected: both exit 0.

- [ ] **Step 2: Run the API unit tests**

Run: `pnpm --filter @research-atlas/api test`
Expected: PASS (3 tests).

- [ ] **Step 3: Run the end-to-end smoke test**

Run: `bash apps/api/test/smoke.sh`
Expected: `0 failed`.

- [ ] **Step 4 (optional, network): a real OpenAlex ingest against a scratch DB**

Run:
```bash
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
psql -h localhost -p 5432 -d postgres -X -q -c "drop database if exists ra_live;"
psql -h localhost -p 5432 -d postgres -X -q -c "create database ra_live;"
psql -h localhost -p 5432 -d ra_live -X -q -f supabase/migrations/0001_init.sql
psql -h localhost -p 5432 -d ra_live -X -q -f supabase/migrations/0002_person_activity_signal.sql
cd apps/api && DATABASE_URL="postgres://$(whoami)@localhost:5432/ra_live" OPENALEX_MAILTO="$USER@example.com" INGEST_AUTHORS_CAP=25 pnpm ingest openalex
```
Expected: prints `[ingest] upserts: {"organizations":>0,"people":>0,...}` with no crash; any caps are listed under "skipped/capped". Then drop `ra_live`.

- [ ] **Step 5: Final commit (if any verification fixes were needed)**

```bash
git add -A && git commit -m "chore(ingest): verification pass" || echo "nothing to commit"
```

---

## Notes for the implementer

- **ESM imports use `.js` suffixes** even though the source is `.ts` — match the existing codebase (e.g. `import { db } from "../db/client.js"`).
- **Migrations are hand-authored SQL** in `supabase/migrations/` and are the source of truth; `drizzle-kit` is only for diffing. Don't generate migrations.
- The `as never` casts where raw OpenAlex JSON enters the `normalize*` functions are deliberate — the fixtures and live API share the same field subset the normalizers read; the unit tests pin that contract.
- **Publications remain background-only:** no `publications` or `publication_authors` rows are written anywhere in this plan. If a future task needs them, that's a separate spec.
