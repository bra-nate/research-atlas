# P7a — Grants from NIH RePORTER → project_grants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create each DS-I Africa project's real NIH grant (award number, funder, amount, dates) from the RePORTER data and link it via a new `project_grants` edge, idempotently.

**Architecture:** Migration `0003` adds `project_grants` + `project_publications` (the latter for P7b) + `publication_authors.match_confidence`. The existing DS-I adapter is extended: `parseDsiAfrica` emits a `grant` per award, and `upsertProject` writes the grant + a `project_grants` edge through the shared upsert layer.

**Tech Stack:** Node + TypeScript (ESM, `.js` import specifiers), Drizzle ORM over Postgres, plain Postgres DDL migrations, `node:test` + `tsx`, NIH RePORTER API.

## Global Constraints

- TypeScript ESM throughout; **import specifiers end in `.js`** even for `.ts` files.
- Tests use `node:test` + `node:assert/strict`, run via `pnpm test` from `apps/api/`. **Only pure functions are unit-tested; DB-touching code is verified by `apps/api/test/smoke.sh`.**
- Every ingested row carries provenance: `source`, `source_url`, `ingest_method`, `ingested_at`, `verification_status = "ingested_unverified"`.
- Grants/edges from this work carry `source = "dsi-africa"`, `ingest_method = "api"`.
- No silent truncation: anything skipped goes into `IngestSummary.skipped`.
- Idempotent: re-running `pnpm ingest dsi-africa` must converge (identical counts).
- Award number = RePORTER `core_project_num` (the stable core, e.g. `U54TW012084`).
- Migrations are plain Postgres DDL under `supabase/migrations/`, applied in numeric order; mirror every schema change in `apps/api/src/db/schema.ts` and `@research-atlas/types`.
- All commands run from `apps/api/` unless stated otherwise.

---

## File Structure

- `supabase/migrations/0003_enrichment_edges.sql` — CREATE: `project_grants`, `project_publications`, `publication_authors.match_confidence`.
- `apps/api/src/db/schema.ts` — MODIFY: add `projectGrants`, `projectPublications` tables; add `matchConfidence` to `publicationAuthors`.
- `packages/types/src/edges.ts` — MODIFY: add `ProjectGrant`, `ProjectPublication`; add `match_confidence` to `PublicationAuthor`.
- `apps/api/src/ingest/types.ts` — MODIFY: extend `GrantUpsert` (amount/currency/dates); add `grant` to `ProjectUpsert`.
- `apps/api/src/ingest/upsert.ts` — MODIFY: extend `upsertGrant`; add `upsertProjectGrant`; wire `upsertProject` to emit grant + edge.
- `apps/api/src/ingest/dsi-africa-normalize.ts` — MODIFY: emit `grant` per award.
- `apps/api/src/ingest/dsi-africa-normalize.test.ts` — MODIFY: assert grant emission.
- `apps/api/src/ingest/__fixtures__/dsi-africa.reporter.json` — REGENERATE: add award amount/date fields.
- `apps/api/test/smoke.sh` — MODIFY: assert a DS-I project has a NIH `project_grants` row.

---

## Task 1: Migration 0003 — edge tables + match_confidence

**Files:**
- Create: `supabase/migrations/0003_enrichment_edges.sql`
- Modify: `apps/api/src/db/schema.ts`
- Modify: `packages/types/src/edges.ts`

**Interfaces:**
- Produces (Drizzle): `projectGrants`, `projectPublications` tables; `publicationAuthors.matchConfidence`.
- Produces (types): `ProjectGrant`, `ProjectPublication` interfaces; `PublicationAuthor.match_confidence`.

No unit test (DDL). Verified by applying the migration to a temp DB + `pnpm typecheck`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0003_enrichment_edges.sql`:
```sql
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
```

- [ ] **Step 2: Apply the migration to a scratch DB to verify it is valid**

Run (from repo root):
```bash
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
psql -h localhost -p 5432 -d postgres -X -q -c "drop database if exists ra_mig; create database ra_mig;"
for f in 0001_init 0002_person_activity_signal 0003_enrichment_edges; do
  psql -h localhost -p 5432 -d ra_mig -v ON_ERROR_STOP=1 -X -q -f "supabase/migrations/$f.sql" >/dev/null && echo "applied $f";
done
psql -h localhost -p 5432 -d postgres -X -q -c "drop database if exists ra_mig;"
```
Expected: `applied 0001_init` / `0002...` / `0003_enrichment_edges` with no errors.

- [ ] **Step 3: Mirror the tables in the Drizzle schema**

In `apps/api/src/db/schema.ts`, append after the `publicationAuthors` table:
```ts
export const projectGrants = pgTable("project_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  grantId: uuid("grant_id").notNull(),
  ...provenance,
});

export const projectPublications = pgTable("project_publications", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  publicationId: uuid("publication_id").notNull(),
  ...provenance,
});
```

- [ ] **Step 4: Add `matchConfidence` to the `publicationAuthors` Drizzle table**

In `apps/api/src/db/schema.ts`, inside the `publicationAuthors` table definition, add after `authorPosition`:
```ts
  matchConfidence: numeric("match_confidence"),
```
(`numeric` is already imported at the top of the file.)

- [ ] **Step 5: Mirror the types in the shared package**

In `packages/types/src/edges.ts`, add `match_confidence` to `PublicationAuthor`:
```ts
export interface PublicationAuthor extends Provenance {
  id: string;
  publication_id: string;
  person_id: string;
  author_position: number | null;
  match_confidence: number | null;
}
```
and append the two new edge interfaces:
```ts
export interface ProjectGrant extends Provenance {
  id: string;
  project_id: string;
  grant_id: string;
}

export interface ProjectPublication extends Provenance {
  id: string;
  project_id: string;
  publication_id: string;
}
```

- [ ] **Step 6: Verify typecheck across the workspace**

Run (from repo root): `pnpm -r typecheck`
Expected: all packages PASS (no errors).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0003_enrichment_edges.sql apps/api/src/db/schema.ts packages/types/src/edges.ts
git commit -m "feat(db): migration 0003 — project_grants, project_publications, match_confidence"
```

---

## Task 2: Grant + project-grant upsert layer

**Files:**
- Modify: `apps/api/src/ingest/types.ts`
- Modify: `apps/api/src/ingest/upsert.ts`

**Interfaces:**
- Consumes: `projectGrants` (Task 1), existing `grants`, `OPENALEX_PROV`, `prov`, `upsertOrg`.
- Produces:
  - `GrantUpsert` gains `amount: string | null`, `currency: string | null`, `startDate: string | null`, `endDate: string | null`.
  - `ProjectUpsert` gains `grant: GrantUpsert | null`.
  - `upsertProjectGrant(projectId: string, grantId: string, sourceUrl: string, p: ProvInput): Promise<void>`.
  - `upsertGrant` returns `Promise<string>` (the grant id) instead of `void`.

No unit test (DB-touching). Verified by `pnpm typecheck` here + smoke in Task 4.

- [ ] **Step 1: Extend `GrantUpsert` and `ProjectUpsert`**

In `apps/api/src/ingest/types.ts`, replace the `GrantUpsert` interface with:
```ts
/** Normalized grant + its funder org. */
export interface GrantUpsert {
  name: string;
  awardNumber: string | null;
  amount: string | null;
  currency: string | null;
  startDate: string | null;
  endDate: string | null;
  funder: OrgUpsert;
  sourceUrl: string;
}
```
and add `grant` to `ProjectUpsert` (after `members`):
```ts
  members: MemberEdge[];
  grant: GrantUpsert | null;
  sourceUrl: string;
```

- [ ] **Step 2: Update the existing `GrantUpsert` producer (OpenAlex) for the new fields**

In `apps/api/src/ingest/openalex-normalize.ts`, in `normalizeGrants`, the object pushed into `byKey` currently sets `name`, `awardNumber`, `funder`, `sourceUrl`. Add the four new nullable fields so it still type-checks:
```ts
      byKey.set(key, {
        name: g.award_id ? `${g.funder_display_name} ${g.award_id}` : g.funder_display_name,
        awardNumber: g.award_id,
        amount: null,
        currency: null,
        startDate: null,
        endDate: null,
        funder: {
```
(Leave the rest of that object unchanged.)

- [ ] **Step 3: Extend `upsertGrant` to write the new columns and return the id**

In `apps/api/src/ingest/upsert.ts`, replace the `upsertGrant` function with:
```ts
export async function upsertGrant(g: GrantUpsert, p: ProvInput = OPENALEX_PROV): Promise<string> {
  const funderOrgId = await upsertOrg(g.funder, p);
  const existing = g.awardNumber
    ? await db.select({ id: grants.id }).from(grants).where(eq(grants.awardNumber, g.awardNumber)).limit(1)
    : await db.select({ id: grants.id }).from(grants).where(sql`lower(name) = lower(${g.name})`).limit(1);
  const values = {
    name: g.name,
    funderOrgId,
    awardNumber: g.awardNumber,
    amount: g.amount,
    currency: g.currency,
    startDate: g.startDate,
    endDate: g.endDate,
    ...prov(g.sourceUrl, p),
  };
  if (existing[0]) {
    await db.update(grants).set(values).where(eq(grants.id, existing[0].id));
    return existing[0].id;
  }
  const [row] = await db.insert(grants).values(values).returning({ id: grants.id });
  return row.id;
}
```
(Resolution is now `award_number`-first so re-runs converge on the same grant.)

- [ ] **Step 4: Add `projectGrants` to the schema import in `upsert.ts`**

In `apps/api/src/ingest/upsert.ts`, add `projectGrants` to the `../db/schema.js` import list (alongside `projectMembers`, `projectPartners`, etc.).

- [ ] **Step 5: Add `upsertProjectGrant` and wire it into `upsertProject`**

In `apps/api/src/ingest/upsert.ts`, append:
```ts
/** Idempotent project↔grant edge keyed on (project, grant). */
export async function upsertProjectGrant(
  projectId: string,
  grantId: string,
  sourceUrl: string,
  p: ProvInput,
): Promise<void> {
  const existing = await db
    .select({ id: projectGrants.id })
    .from(projectGrants)
    .where(sql`project_id = ${projectId} and grant_id = ${grantId}`)
    .limit(1);
  if (existing[0]) return;
  await db.insert(projectGrants).values({ projectId, grantId, ...prov(sourceUrl, p) });
}
```
Then, in `upsertProject`, immediately before `return projectId;`, add:
```ts
  if (proj.grant) {
    const grantId = await upsertGrant(proj.grant, p);
    await upsertProjectGrant(projectId, grantId, proj.sourceUrl, p);
  }
```

- [ ] **Step 6: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/ingest/types.ts apps/api/src/ingest/upsert.ts apps/api/src/ingest/openalex-normalize.ts
git commit -m "feat(ingest): grant fields + idempotent project_grants upsert"
```

---

## Task 3: DS-I parser emits the NIH grant

**Files:**
- Regenerate: `apps/api/src/ingest/__fixtures__/dsi-africa.reporter.json`
- Modify: `apps/api/src/ingest/dsi-africa-normalize.ts`
- Test: `apps/api/src/ingest/dsi-africa-normalize.test.ts`

**Interfaces:**
- Consumes: extended `GrantUpsert`, `ProjectUpsert.grant` (Task 2).
- Produces: `parseDsiAfrica` sets `project.grant` per award.

- [ ] **Step 1: Regenerate the fixture with award amount + dates**

Run (from `apps/api/`):
```bash
cat > /tmp/dsi-q.json <<'JSON'
{"criteria":{"opportunity_numbers":["RFA-RM-20-015","RFA-RM-20-017","RFA-RM-20-018"]},"include_fields":["ApplId","ProjectTitle","PrincipalInvestigators","Organization","ProjectNum","CoreProjectNum","FiscalYear","OpportunityNumber","AwardAmount","ProjectStartDate","ProjectEndDate"],"offset":0,"limit":100,"sort_field":"fiscal_year","sort_order":"desc"}
JSON
curl -sL -m 40 -X POST "https://api.reporter.nih.gov/v2/projects/search" -H "Content-Type: application/json" --data-binary @/tmp/dsi-q.json -o src/ingest/__fixtures__/dsi-africa.reporter.json -w "HTTP %{http_code}\n"
```
Expected: `HTTP 200`. (The existing parser tests assert title/org/PI and stay green.)

- [ ] **Step 2: Write the failing test**

In `apps/api/src/ingest/dsi-africa-normalize.test.ts`, append:
```ts
test("parseDsiAfrica emits a NIH grant per award keyed by core project number", () => {
  const projects = parseDsiAfrica(json);
  const elwazi = projects.find((p) => /elwazi/i.test(p.title))!;
  assert.ok(elwazi.grant, "award has a grant");
  assert.match(elwazi.grant!.awardNumber!, /^U2CEB032224$/);
  assert.equal(elwazi.grant!.funder.name, "National Institutes of Health (NIH)");
  assert.equal(elwazi.grant!.funder.orgType, "funder");
  // amount is a numeric string when RePORTER provides it
  assert.match(elwazi.grant!.amount ?? "", /^[0-9]+$/);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test 2>&1 | grep -A3 "NIH grant"`
Expected: FAIL — `elwazi.grant` is `undefined` (property not yet emitted).

- [ ] **Step 4: Implement grant emission in the parser**

In `apps/api/src/ingest/dsi-africa-normalize.ts`:

(a) Extend the `ReporterResult` interface with the new fields:
```ts
interface ReporterResult {
  appl_id?: number;
  core_project_num?: string | null;
  fiscal_year?: number | null;
  project_title?: string | null;
  opportunity_number?: string | null;
  award_amount?: number | null;
  project_start_date?: string | null;
  project_end_date?: string | null;
  principal_investigators?: ReporterPI[];
  organization?: ReporterOrg | null;
}
```

(b) Add a `GrantUpsert` import and two helpers near the top (after `cleanTitle`):
```ts
import type { GrantUpsert, MemberEdge, OrgUpsert, PersonUpsert, ProjectUpsert } from "./types.js";

const NIH_FUNDER: OrgUpsert = {
  name: "National Institutes of Health (NIH)",
  shortName: "NIH",
  orgType: "funder",
  country: "United States",
  website: "https://www.nih.gov",
  rorId: null,
  sourceUrl: "https://reporter.nih.gov",
};

/** "2021-09-20T00:00:00" → "2021-09-20"; null/empty → null. */
function isoDate(d: string | null | undefined): string | null {
  return d ? d.slice(0, 10) : null;
}

function grantFor(r: ReporterResult, sourceUrl: string): GrantUpsert | null {
  const award = r.core_project_num?.trim();
  if (!award) return null;
  return {
    name: `NIH ${award}`,
    awardNumber: award,
    amount: r.award_amount != null ? String(r.award_amount) : null,
    currency: r.award_amount != null ? "USD" : null,
    startDate: isoDate(r.project_start_date),
    endDate: isoDate(r.project_end_date),
    funder: { ...NIH_FUNDER, sourceUrl },
    sourceUrl,
  };
}
```
(Replace the existing `import type { MemberEdge, OrgUpsert, PersonUpsert, ProjectUpsert } from "./types.js";` line with the combined import above.)

(c) In `parseDsiAfrica`, set `grant` on the pushed project object (add the line alongside `members`):
```ts
    out.push({
      title,
      programName: "DS-I Africa",
      country: leadOrg.country,
      leadOrg,
      pi,
      partners: [{ org: leadOrg, role: "lead" }],
      members,
      grant: grantFor(r, sourceUrl),
      sourceUrl,
    });
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: all DS-I + other unit tests PASS (fail 0).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ingest/dsi-africa-normalize.ts apps/api/src/ingest/dsi-africa-normalize.test.ts apps/api/src/ingest/__fixtures__/dsi-africa.reporter.json
git commit -m "feat(ingest): DS-I parser emits NIH grant per award (RePORTER)"
```

---

## Task 4: Smoke test + idempotency

**Files:**
- Modify: `apps/api/test/smoke.sh`

**Interfaces:**
- Consumes: the `dsi-africa` adapter (now emitting grants) via `pnpm ingest`.

- [ ] **Step 1: Apply 0003 in the smoke setup**

In `apps/api/test/smoke.sh`, find the line applying `0002_person_activity_signal.sql`:
```bash
psql -h localhost -p 5432 -d $DB -v ON_ERROR_STOP=1 -X -q -f "$ROOT/supabase/migrations/0002_person_activity_signal.sql" >/dev/null
```
and add immediately after it:
```bash
psql -h localhost -p 5432 -d $DB -v ON_ERROR_STOP=1 -X -q -f "$ROOT/supabase/migrations/0003_enrichment_edges.sql" >/dev/null
```

- [ ] **Step 2: Add the project_grants assertions**

In `apps/api/test/smoke.sh`, just before the `echo "### Result..."` line, add:
```bash
# --- P7a: DS-I project grants from RePORTER ---
PG_COUNT=$(psql -h localhost -p 5432 -d $DB -tAc "select count(*) from project_grants")
ck "DS-I projects have grant links" 1 "$([ "${PG_COUNT:-0}" -ge 1 ] && echo 1 || echo 0)"
# the linked grant is a real NIH award with a core project number, funded by NIH (org_type 'funder')
NIH_GRANT=$(psql -h localhost -p 5432 -d $DB -tAc "
  select count(*) from project_grants pg
  join grants g on g.id = pg.grant_id
  join organizations o on o.id = g.funder_org_id
  where g.award_number is not null and o.org_type = 'funder' and o.name ilike '%National Institutes of Health%'")
ck "grant link resolves to a NIH-funded award" 1 "$([ "${NIH_GRANT:-0}" -ge 1 ] && echo 1 || echo 0)"
```

- [ ] **Step 3: Run the smoke test**

Run (from repo root): `bash apps/api/test/smoke.sh 2>&1 | grep -E "✓|✗|### Result"`
Expected: all checks pass including the two new P7a checks; `### Result: N passed, 0 failed`.

- [ ] **Step 4: Verify idempotency (no duplicate grants/edges on re-run)**

Run (from `apps/api/`):
```bash
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
DB=ra_p7a; ROOT="$(cd ../.. && pwd)"
psql -h localhost -p 5432 -d postgres -X -q -c "drop database if exists $DB; create database $DB;" >/dev/null
for f in 0001_init 0002_person_activity_signal 0003_enrichment_edges; do psql -h localhost -p 5432 -d $DB -v ON_ERROR_STOP=1 -X -q -f "$ROOT/supabase/migrations/$f.sql" >/dev/null; done
URL="postgres://$(whoami)@localhost:5432/$DB"
for run in 1 2; do DATABASE_URL="$URL" pnpm ingest dsi-africa >/dev/null; echo "run $run: grants=$(psql -h localhost -p 5432 -d $DB -tAc 'select count(*) from grants') project_grants=$(psql -h localhost -p 5432 -d $DB -tAc 'select count(*) from project_grants')"; done
psql -h localhost -p 5432 -d postgres -X -q -c "drop database if exists $DB;" >/dev/null
```
Expected: run 1 and run 2 print identical `grants` and `project_grants` counts.

- [ ] **Step 5: Commit**

```bash
git add apps/api/test/smoke.sh
git commit -m "test(ingest): smoke + idempotency for DS-I project grants"
```

---

## Self-Review

**Spec coverage:**
- Migration `0003` with `project_grants` + `project_publications` + `match_confidence` → Task 1. ✓
- Grants sourced from RePORTER (award number, funder NIH, amount, dates), linked via `project_grants` → Tasks 2, 3. ✓
- Award number = `core_project_num` → Task 3 `grantFor`. ✓
- Emission lives in the DS-I adapter; `upsertProject` writes grant + edge → Task 2 Step 5. ✓
- Provenance `source="dsi-africa"`, `ingest_method="api"` → inherited from the DS-I adapter's `SOURCE` passed through `upsertProject`. ✓
- Idempotent (grant by `award_number`, edge by tuple) → Task 2 Steps 3/5, Task 4 Step 4. ✓
- Unit test (grant emission) + smoke (NIH project_grants) → Tasks 3, 4. ✓
- Out of scope (publications/authors/project_publications population, OpenAlex, DELTAS grants) → not touched. ✓

**Placeholder scan:** No TODO/TBD/"handle edge cases"; every code step shows complete code; the regenerated fixture is produced by a concrete curl command.

**Type consistency:** `GrantUpsert` (amount/currency/startDate/endDate) defined in Task 2 and produced in Task 3 (`grantFor`) match. `upsertGrant` returns `Promise<string>` (Task 2) and is used for its id in `upsertProject` (Task 2 Step 5). `upsertProjectGrant(projectId, grantId, sourceUrl, p)` signature consistent between definition and call. `projectGrants` Drizzle table (Task 1) used in Task 2. `ProjectUpsert.grant` defined in Task 2, set in Task 3.
