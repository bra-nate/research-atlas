# DS-I Africa + DELTAS Africa Structural Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two `scrape`-method ingest adapters (DS-I Africa, DELTAS Africa) that load the structural tier (programme → projects/consortia → people + partner orgs) from real pages, and prove an org and a person resolve across sources.

**Architecture:** Each adapter reads a committed real HTML snapshot from `__fixtures__/` (live fetch behind `INGEST_LIVE=1`), parses it with `node-html-parser` into normalised records, and writes through shared idempotent upserts. A new pure person-match decision (`pickPersonMatch`) plus a DB wrapper (`matchPersonToExisting`) lets scraped people without an ORCID attach to an existing person when their org agrees.

**Tech Stack:** Node + TypeScript (ESM, `.js` import specifiers), Drizzle ORM over Postgres, `node:test` + `tsx` for tests, `node-html-parser` for HTML parsing.

## Global Constraints

- TypeScript ESM throughout; **import specifiers end in `.js`** even for `.ts` files (e.g. `import { db } from "../db/client.js"`).
- Tests use `node:test` + `node:assert/strict`, run via `pnpm test` (`node --import tsx --test 'src/**/*.test.ts'`). **Only pure functions are unit-tested; DB-touching code is verified by `apps/api/test/smoke.sh`** — follow this split.
- Every ingested row carries provenance: `source`, `source_url`, `ingest_method`, `ingested_at`, `verification_status = "ingested_unverified"`.
- No silent truncation: anything skipped/capped goes into `IngestSummary.skipped`.
- A parse failure on one record is logged to `summary.skipped` and skipped — it never aborts the run.
- V1 guardrails: no contact data, no accounts, no claim/collaboration flow.
- Snapshots are captured from the **real** pages so ingested data is honest; never hand-fabricate programme data.
- All commands run from `apps/api/` unless stated otherwise.

---

## File Structure

- `apps/api/src/ingest/types.ts` — MODIFY: add `ProvInput`, `ProgramUpsert`, `ProjectUpsert`, `MemberEdge`, `PartnerEdge`.
- `apps/api/src/ingest/scrape-http.ts` — CREATE: generic `httpGet` for live fetch (behind `INGEST_LIVE`).
- `apps/api/src/ingest/resolve.ts` — CREATE: `pickPersonMatch` (pure) + `matchPersonToExisting` (DB).
- `apps/api/src/ingest/resolve.test.ts` — CREATE: unit tests for `pickPersonMatch`.
- `apps/api/src/ingest/upsert.ts` — MODIFY: parameterise provenance; add `upsertProgram`, `upsertProject`, `upsertProjectMember`, `upsertProjectPartner`; route `upsertPerson` through `matchPersonToExisting`.
- `apps/api/src/ingest/deltas-normalize.ts` + `.test.ts` — CREATE: DELTAS parser.
- `apps/api/src/ingest/dsi-africa-normalize.ts` + `.test.ts` — CREATE: DS-I parser.
- `apps/api/src/ingest/deltas.ts`, `apps/api/src/ingest/dsi-africa.ts` — CREATE: the two adapters.
- `apps/api/src/ingest/__fixtures__/deltas.html`, `dsi-africa.html` — CREATE: committed real snapshots.
- `apps/api/src/ingest/runner.ts` — MODIFY: register both adapters.
- `apps/api/test/smoke.sh` — MODIFY: ingest both, assert cross-source org + person resolution.
- `apps/api/package.json` — MODIFY: add `node-html-parser` dependency.

---

## Task 1: Shared types + scrape HTTP helper + dependency

**Files:**
- Modify: `apps/api/src/ingest/types.ts`
- Create: `apps/api/src/ingest/scrape-http.ts`
- Modify: `apps/api/package.json` (via `pnpm add`)

**Interfaces:**
- Produces: `ProvInput`, `ProgramUpsert`, `ProjectUpsert`, `MemberEdge`, `PartnerEdge` (types); `httpGet(url: string): Promise<string>`.

- [ ] **Step 1: Add the HTML parser dependency**

Run (from `apps/api/`):
```bash
pnpm add node-html-parser
```
Expected: `node-html-parser` appears under `dependencies` in `apps/api/package.json`.

- [ ] **Step 2: Add new normalised types**

Append to `apps/api/src/ingest/types.ts`:
```ts
/** Per-record provenance descriptor passed into the upsert layer. */
export interface ProvInput {
  source: string;
  ingestMethod: "manual" | "csv" | "scrape" | "api" | "enrichment";
}

/** Normalised programme (umbrella initiative — ACE, DELTAS, DS-I Africa). */
export interface ProgramUpsert {
  name: string;
  shortName: string | null;
  region: string | null;
  website: string | null;
  sourceUrl: string;
}

/** A person on a project, with their role on it. */
export interface MemberEdge {
  person: PersonUpsert;
  role: "pi" | "co_pi" | "investigator" | "fellow" | "student" | "collaborator";
}

/** A partner organisation on a project, with its role on it. */
export interface PartnerEdge {
  org: OrgUpsert;
  role: "lead" | "hub" | "partner" | "funder";
}

/** Normalised project/consortium plus its programme, lead, PI and partners. */
export interface ProjectUpsert {
  title: string;
  programName: string;
  country: string | null;
  leadOrg: OrgUpsert | null;
  pi: PersonUpsert | null;
  partners: PartnerEdge[];
  members: MemberEdge[];
  sourceUrl: string;
}
```

- [ ] **Step 3: Write the scrape HTTP helper**

Create `apps/api/src/ingest/scrape-http.ts`:
```ts
/**
 * Minimal HTML fetcher for scrape adapters. Only used when INGEST_LIVE=1 to
 * refresh a committed snapshot; tests and default runs read the fixture instead.
 */
class NonRetryableError extends Error {}

export async function httpGet(url: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "research-atlas-ingest" } });
      if (res.status === 429 || res.status >= 500) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new NonRetryableError(`GET ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      if (err instanceof NonRetryableError) throw err;
      lastErr = err;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw new Error(`scrape GET failed after retries: ${url} (${String(lastErr)})`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
```

- [ ] **Step 4: Verify it typechecks**

Run (from `apps/api/`): `pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/src/ingest/types.ts apps/api/src/ingest/scrape-http.ts ../../pnpm-lock.yaml
git commit -m "feat(ingest): shared scrape types + html fetch helper"
```

---

## Task 2: Person resolver (pure decision + DB wrapper)

**Files:**
- Create: `apps/api/src/ingest/resolve.ts`
- Test: `apps/api/src/ingest/resolve.test.ts`

**Interfaces:**
- Consumes: `db` from `../db/client.js`, `people` from `../db/schema.js`.
- Produces:
  - `interface PersonCandidate { id: string; orcid: string | null; openalexAuthorId: string | null; normalisedName: string | null; primaryOrgId: string | null }`
  - `interface MatchInput { orcid: string | null; openalexAuthorId: string | null; normalisedName: string; orgId: string | null }`
  - `pickPersonMatch(input: MatchInput, candidates: PersonCandidate[]): { personId: string; confidence: number } | null` (PURE)
  - `matchPersonToExisting(input: MatchInput): Promise<{ personId: string; confidence: number } | null>` (DB)

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/ingest/resolve.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickPersonMatch } from "./resolve.js";

const cand = (over = {}) => ({
  id: "p1",
  orcid: null,
  openalexAuthorId: null,
  normalisedName: "gordon awandare",
  primaryOrgId: "org-ug",
  ...over,
});

test("ORCID match wins with confidence 1.0", () => {
  const m = pickPersonMatch(
    { orcid: "0000-0002-8793-3641", openalexAuthorId: null, normalisedName: "g awandare", orgId: null },
    [cand({ orcid: "0000-0002-8793-3641" })],
  );
  assert.deepEqual(m, { personId: "p1", confidence: 1.0 });
});

test("OpenAlex author id match has confidence 0.95", () => {
  const m = pickPersonMatch(
    { orcid: null, openalexAuthorId: "A5023888391", normalisedName: "x", orgId: null },
    [cand({ openalexAuthorId: "A5023888391" })],
  );
  assert.deepEqual(m, { personId: "p1", confidence: 0.95 });
});

test("name + shared org matches at confidence 0.7", () => {
  const m = pickPersonMatch(
    { orcid: null, openalexAuthorId: null, normalisedName: "gordon awandare", orgId: "org-ug" },
    [cand()],
  );
  assert.deepEqual(m, { personId: "p1", confidence: 0.7 });
});

test("name-only (no org agreement) is rejected", () => {
  assert.equal(
    pickPersonMatch(
      { orcid: null, openalexAuthorId: null, normalisedName: "gordon awandare", orgId: null },
      [cand()],
    ),
    null,
  );
  assert.equal(
    pickPersonMatch(
      { orcid: null, openalexAuthorId: null, normalisedName: "gordon awandare", orgId: "org-other" },
      [cand()],
    ),
    null,
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test 2>&1 | grep -A2 resolve`
Expected: FAIL — cannot find module `./resolve.js` / `pickPersonMatch` is not a function.

- [ ] **Step 3: Implement `resolve.ts`**

Create `apps/api/src/ingest/resolve.ts`:
```ts
import { or, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { people } from "../db/schema.js";

export interface PersonCandidate {
  id: string;
  orcid: string | null;
  openalexAuthorId: string | null;
  normalisedName: string | null;
  primaryOrgId: string | null;
}

export interface MatchInput {
  orcid: string | null;
  openalexAuthorId: string | null;
  normalisedName: string;
  orgId: string | null;
}

/**
 * Decide which existing person an incoming person is, given candidate rows.
 * ORCID (1.0) > OpenAlex author id (0.95) > normalised name corroborated by a
 * shared primary org (0.7). Name-only with no org agreement is NOT a match.
 */
export function pickPersonMatch(
  input: MatchInput,
  candidates: PersonCandidate[],
): { personId: string; confidence: number } | null {
  if (input.orcid) {
    const hit = candidates.find((c) => c.orcid && c.orcid === input.orcid);
    if (hit) return { personId: hit.id, confidence: 1.0 };
  }
  if (input.openalexAuthorId) {
    const hit = candidates.find((c) => c.openalexAuthorId && c.openalexAuthorId === input.openalexAuthorId);
    if (hit) return { personId: hit.id, confidence: 0.95 };
  }
  if (input.orgId) {
    const hit = candidates.find(
      (c) => c.normalisedName === input.normalisedName && c.primaryOrgId && c.primaryOrgId === input.orgId,
    );
    if (hit) return { personId: hit.id, confidence: 0.7 };
  }
  return null;
}

/** Load plausible candidates from the DB and run the pure matcher. */
export async function matchPersonToExisting(
  input: MatchInput,
): Promise<{ personId: string; confidence: number } | null> {
  const clauses = [eq(people.normalisedName, input.normalisedName)];
  if (input.orcid) clauses.push(eq(people.orcid, input.orcid));
  if (input.openalexAuthorId) clauses.push(eq(people.openalexAuthorId, input.openalexAuthorId));

  const rows = await db
    .select({
      id: people.id,
      orcid: people.orcid,
      openalexAuthorId: people.openalexAuthorId,
      normalisedName: people.normalisedName,
      primaryOrgId: people.primaryOrgId,
    })
    .from(people)
    .where(or(...clauses));

  return pickPersonMatch(input, rows);
}

// Touch sql to keep the import meaningful if later extended; harmless no-op.
void sql;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test 2>&1 | grep -A2 resolve`
Expected: PASS (4 resolve tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ingest/resolve.ts apps/api/src/ingest/resolve.test.ts
git commit -m "feat(ingest): person resolver (orcid > openalex id > name+org)"
```

---

## Task 3: Shared idempotent upserts (programme/project/edges) + provenance param

**Files:**
- Modify: `apps/api/src/ingest/upsert.ts`

**Interfaces:**
- Consumes: `ProvInput`, `ProgramUpsert`, `ProjectUpsert`, `OrgUpsert`, `PersonUpsert` from `./types.js`; `matchPersonToExisting` from `./resolve.js`.
- Produces:
  - `upsertOrg(o: OrgUpsert, p?: ProvInput): Promise<string>`
  - `upsertPerson(p: PersonUpsert, prov?: ProvInput): Promise<string>`
  - `upsertProgram(prog: ProgramUpsert, p?: ProvInput): Promise<string>`
  - `upsertProject(proj: ProjectUpsert, p?: ProvInput): Promise<string>`
  - `upsertProjectMember(projectId, personId, role, sourceUrl, p?): Promise<void>`
  - `upsertProjectPartner(projectId, orgId, role, sourceUrl, p?): Promise<void>`

This task has no unit test (DB-touching — covered by `smoke.sh` in Task 6). Verify by `pnpm typecheck` + the existing OpenAlex normalize tests still passing.

- [ ] **Step 1: Replace the provenance helper with a parameterised one**

In `apps/api/src/ingest/upsert.ts`, replace the current `prov` constant:
```ts
const prov = (sourceUrl: string) => ({
  source: "openalex",
  sourceUrl,
  ingestMethod: "api" as const,
  ingestedAt: new Date(),
  verificationStatus: "ingested_unverified" as const,
});
```
with:
```ts
import type { GrantUpsert, OrgUpsert, PersonUpsert, ProgramUpsert, ProjectUpsert, ProvInput } from "./types.js";
import { matchPersonToExisting } from "./resolve.js";

const OPENALEX_PROV: ProvInput = { source: "openalex", ingestMethod: "api" };

const prov = (sourceUrl: string, p: ProvInput = OPENALEX_PROV) => ({
  source: p.source,
  sourceUrl,
  ingestMethod: p.ingestMethod,
  ingestedAt: new Date(),
  verificationStatus: "ingested_unverified" as const,
});
```
(Remove the old `import type { GrantUpsert, OrgUpsert, PersonUpsert } from "./types.js";` line — it is replaced above. Keep the existing `import { eq, sql } from "drizzle-orm";`, `import { db } from "../db/client.js";` and add `grants, organizations, people` already imported; add `programs, projects, projectMembers, projectPartners` to that schema import.)

- [ ] **Step 2: Update the schema import**

Change the schema import line in `upsert.ts` from:
```ts
import { grants, organizations, people } from "../db/schema.js";
```
to:
```ts
import {
  grants,
  organizations,
  people,
  programs,
  projectMembers,
  projectPartners,
  projects,
} from "../db/schema.js";
```

- [ ] **Step 3: Thread the provenance param through `upsertOrg`**

In `upsertOrg`, change the signature and the spread:
```ts
export async function upsertOrg(o: OrgUpsert, p: ProvInput = OPENALEX_PROV): Promise<string> {
```
and change `...prov(o.sourceUrl),` (inside `values`) to `...prov(o.sourceUrl, p),`.

- [ ] **Step 4: Route `upsertPerson` through the resolver and accept provenance**

Replace the body of `upsertPerson` with:
```ts
export async function upsertPerson(p: PersonUpsert, prv: ProvInput = OPENALEX_PROV): Promise<string> {
  let primaryOrgId: string | null = null;
  if (p.primaryOrgRor) {
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.rorId, p.primaryOrgRor)).limit(1);
    primaryOrgId = org?.id ?? null;
  }

  const normalisedName = p.fullName.toLowerCase().trim();
  const match = await matchPersonToExisting({
    orcid: p.orcid,
    openalexAuthorId: p.openalexAuthorId,
    normalisedName,
    orgId: primaryOrgId,
  });

  const values = {
    fullName: p.fullName,
    normalisedName,
    specializations: p.specializations,
    orcid: p.orcid,
    openalexAuthorId: p.openalexAuthorId,
    worksCount: p.worksCount,
    lastActiveYear: p.lastActiveYear,
    primaryOrgId,
    ...prov(p.sourceUrl, prv),
  };
  if (match) {
    await db.update(people).set(values).where(eq(people.id, match.personId));
    return match.personId;
  }
  const [row] = await db.insert(people).values(values).returning({ id: people.id });
  return row.id;
}
```
(Note: this preserves prior behaviour for ORCID/OpenAlex-id people — the matcher returns the same row those keys would have found — while also catching name+org matches. Do NOT null out an existing `orcid` with an incoming null: if the incoming `p.orcid` is null but the matched row had one, keep the row's value. Guard it: before the update, when `p.orcid == null` read the existing `orcid`/`openalexAuthorId` and reuse them.)

Implement that guard — replace the `if (match) { ... }` block with:
```ts
  if (match) {
    const [cur] = await db
      .select({ orcid: people.orcid, openalexAuthorId: people.openalexAuthorId })
      .from(people)
      .where(eq(people.id, match.personId))
      .limit(1);
    await db
      .update(people)
      .set({
        ...values,
        orcid: values.orcid ?? cur?.orcid ?? null,
        openalexAuthorId: values.openalexAuthorId ?? cur?.openalexAuthorId ?? null,
      })
      .where(eq(people.id, match.personId));
    return match.personId;
  }
```

- [ ] **Step 5: Thread provenance through `upsertGrant`**

Change `upsertGrant`'s signature to `export async function upsertGrant(g: GrantUpsert, p: ProvInput = OPENALEX_PROV): Promise<void> {`, pass `p` into its `upsertOrg(g.funder, p)` call, and change `...prov(g.sourceUrl),` to `...prov(g.sourceUrl, p),`.

- [ ] **Step 6: Add the four new upserts**

Append to `apps/api/src/ingest/upsert.ts`:
```ts
/** Upsert a programme by lower(name). Returns its id. */
export async function upsertProgram(prog: ProgramUpsert, p: ProvInput): Promise<string> {
  const existing = await db
    .select({ id: programs.id })
    .from(programs)
    .where(sql`lower(name) = lower(${prog.name})`)
    .limit(1);
  const values = {
    name: prog.name,
    shortName: prog.shortName,
    region: prog.region,
    website: prog.website,
    ...prov(prog.sourceUrl, p),
  };
  if (existing[0]) {
    await db.update(programs).set(values).where(eq(programs.id, existing[0].id));
    return existing[0].id;
  }
  const [row] = await db.insert(programs).values(values).returning({ id: programs.id });
  return row.id;
}

/**
 * Upsert a project/consortium by lower(title), resolving its programme, lead org,
 * PI, partners, and member edges. Returns the project id.
 */
export async function upsertProject(proj: ProjectUpsert, p: ProvInput): Promise<string> {
  const programId = await upsertProgram(
    { name: proj.programName, shortName: null, region: null, website: null, sourceUrl: proj.sourceUrl },
    p,
  );
  const leadOrgId = proj.leadOrg ? await upsertOrg(proj.leadOrg, p) : null;
  const piPersonId = proj.pi ? await upsertPerson(proj.pi, p) : null;

  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(sql`lower(title) = lower(${proj.title})`)
    .limit(1);
  const values = {
    title: proj.title,
    programId,
    leadOrgId,
    piPersonId,
    country: proj.country,
    ...prov(proj.sourceUrl, p),
  };
  const projectId = existing[0]
    ? (await db.update(projects).set(values).where(eq(projects.id, existing[0].id)), existing[0].id)
    : (await db.insert(projects).values(values).returning({ id: projects.id }))[0].id;

  if (piPersonId) await upsertProjectMember(projectId, piPersonId, "pi", proj.sourceUrl, p);
  for (const m of proj.members) {
    const personId = await upsertPerson(m.person, p);
    await upsertProjectMember(projectId, personId, m.role, proj.sourceUrl, p);
  }
  for (const pt of proj.partners) {
    const orgId = await upsertOrg(pt.org, p);
    await upsertProjectPartner(projectId, orgId, pt.role, proj.sourceUrl, p);
  }
  return projectId;
}

/** Idempotent membership edge keyed on (project, person, role). */
export async function upsertProjectMember(
  projectId: string,
  personId: string,
  role: "pi" | "co_pi" | "investigator" | "fellow" | "student" | "collaborator",
  sourceUrl: string,
  p: ProvInput,
): Promise<void> {
  const existing = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(sql`project_id = ${projectId} and person_id = ${personId} and role = ${role}`)
    .limit(1);
  if (existing[0]) return;
  await db.insert(projectMembers).values({ projectId, personId, role, ...prov(sourceUrl, p) });
}

/** Idempotent partner edge keyed on (project, org, role). */
export async function upsertProjectPartner(
  projectId: string,
  orgId: string,
  role: "lead" | "hub" | "partner" | "funder",
  sourceUrl: string,
  p: ProvInput,
): Promise<void> {
  const existing = await db
    .select({ id: projectPartners.id })
    .from(projectPartners)
    .where(sql`project_id = ${projectId} and org_id = ${orgId} and role = ${role}`)
    .limit(1);
  if (existing[0]) return;
  await db.insert(projectPartners).values({ projectId, orgId, role, ...prov(sourceUrl, p) });
}
```

- [ ] **Step 7: Verify typecheck + existing tests still pass**

Run (from `apps/api/`): `pnpm typecheck && pnpm test`
Expected: typecheck PASS; all existing normalize tests + resolve tests PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/ingest/upsert.ts
git commit -m "feat(ingest): shared program/project/edge upserts + provenance param"
```

---

## Task 4: DELTAS Africa adapter (has the hero overlap — build first)

**Files:**
- Create: `apps/api/src/ingest/__fixtures__/deltas.html` (real snapshot)
- Create: `apps/api/src/ingest/deltas-normalize.ts`
- Test: `apps/api/src/ingest/deltas-normalize.test.ts`
- Create: `apps/api/src/ingest/deltas.ts`
- Modify: `apps/api/src/ingest/runner.ts`

**Interfaces:**
- Consumes: `httpGet` from `./scrape-http.js`; `upsertProject` etc. from `./upsert.js`; `ProjectUpsert`, `Adapter`, `IngestSummary`, `ProvInput` from `./types.js`.
- Produces: `parseDeltas(html: string): ProjectUpsert[]`; `deltasAdapter: Adapter`.

- [ ] **Step 1: Capture the real snapshot**

Fetch the DELTAS Africa programme/consortia listing and save the HTML verbatim. From `apps/api/`:
```bash
curl -sL -A "research-atlas-ingest" "https://www.aasciences.africa/deltas" -o src/ingest/__fixtures__/deltas.html
```
If that page is JS-rendered or blocked, use the WebFetch tool to retrieve the consortia listing and save the returned HTML/markup to the same path. **Open the saved file and read its real structure** (the consortium names, the lead org, the director) before writing selectors. Confirm it contains the real **WACCBIP-DELTAS** consortium led by **Gordon Awandare** at **University of Ghana** (DELTAS Phase I, public record); if the live page no longer lists Phase I consortia, capture the AAS DELTAS programme archive page that does, and note the URL used in a comment at the top of `deltas.ts`.

- [ ] **Step 2: Write the failing parser test**

Create `apps/api/src/ingest/deltas-normalize.test.ts` (assert the real records that MUST be present — adjust the non-Awandare assertions to match the captured snapshot's actual consortia):
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseDeltas } from "./deltas-normalize.js";

const html = readFileSync(fileURLToPath(new URL("./__fixtures__/deltas.html", import.meta.url)), "utf8");

test("parseDeltas extracts consortia with programme, lead org and director", () => {
  const projects = parseDeltas(html);
  assert.ok(projects.length >= 1, "at least one consortium parsed");
  for (const p of projects) {
    assert.equal(p.programName, "DELTAS Africa");
    assert.ok(p.title.length > 0);
    assert.ok(p.sourceUrl.startsWith("http"));
  }
});

test("parseDeltas includes the WACCBIP-DELTAS hero consortium led by Awandare", () => {
  const projects = parseDeltas(html);
  const waccbip = projects.find((p) => /waccbip/i.test(p.title));
  assert.ok(waccbip, "WACCBIP-DELTAS consortium present");
  assert.ok(waccbip!.pi, "has a PI/director");
  assert.match(waccbip!.pi!.fullName, /awandare/i);
  assert.ok(
    waccbip!.leadOrg && /ghana/i.test(waccbip!.leadOrg.name),
    "lead org is University of Ghana",
  );
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test 2>&1 | grep -A2 deltas`
Expected: FAIL — cannot find module `./deltas-normalize.js`.

- [ ] **Step 4: Implement the parser**

Create `apps/api/src/ingest/deltas-normalize.ts`. Use `node-html-parser`; **adjust the selectors to the real captured DOM** (the structure below is the starting template — confirm tag/class names against `deltas.html` and edit):
```ts
import { parse } from "node-html-parser";
import type { OrgUpsert, PersonUpsert, ProjectUpsert } from "./types.js";

const PROGRAMME = "DELTAS Africa";
const BASE = "https://www.aasciences.africa/deltas";

function org(name: string): OrgUpsert {
  return {
    name: name.trim(),
    shortName: null,
    orgType: "university",
    country: null,
    website: null,
    rorId: null,
    sourceUrl: BASE,
  };
}

function person(fullName: string, sourceUrl: string): PersonUpsert {
  return {
    fullName: fullName.trim(),
    orcid: null,
    openalexAuthorId: null,
    specializations: [],
    worksCount: null,
    lastActiveYear: null,
    primaryOrgRor: null,
    sourceUrl,
  };
}

/**
 * Parse the DELTAS consortia listing into normalised projects. Each consortium
 * card yields: title, lead org, director (PI). Selectors below MUST match the
 * committed snapshot — confirm against __fixtures__/deltas.html and adjust.
 */
export function parseDeltas(html: string): ProjectUpsert[] {
  const root = parse(html);
  const cards = root.querySelectorAll(".consortium, .views-row, article");
  const out: ProjectUpsert[] = [];
  for (const card of cards) {
    const title = card.querySelector("h2, h3, .title")?.text.trim();
    if (!title) continue;
    const leadName = card.querySelector(".lead-org, .institution")?.text.trim();
    const directorName = card.querySelector(".director, .pi, .lead-person")?.text.trim();
    const href = card.querySelector("a")?.getAttribute("href") ?? "";
    const sourceUrl = href.startsWith("http") ? href : `${BASE}${href}`;
    out.push({
      title,
      programName: PROGRAMME,
      country: null,
      leadOrg: leadName ? org(leadName) : null,
      pi: directorName ? person(directorName, sourceUrl) : null,
      partners: leadName ? [{ org: org(leadName), role: "lead" }] : [],
      members: [],
      sourceUrl,
    });
  }
  return out;
}
```
Then run `pnpm test 2>&1 | grep -A4 deltas` and **edit the selectors until both tests pass against the real snapshot**. If the real Awandare/University-of-Ghana row carries his ORCID on the page, set it: `person(...)` → add `orcid: "0000-0002-8793-3641"` for that record so resolution uses the strong key. (Confidence-0.7 name+org fallback covers it even without the ORCID.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test 2>&1 | grep -A4 deltas`
Expected: PASS (2 deltas tests).

- [ ] **Step 6: Write the adapter**

Create `apps/api/src/ingest/deltas.ts`:
```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { httpGet } from "./scrape-http.js";
import { parseDeltas } from "./deltas-normalize.js";
import { upsertProject } from "./upsert.js";
import type { Adapter, IngestSummary, ProvInput } from "./types.js";

const SOURCE: ProvInput = { source: "deltas", ingestMethod: "scrape" };
const LIVE_URL = "https://www.aasciences.africa/deltas";

async function loadHtml(): Promise<string> {
  if (process.env.INGEST_LIVE === "1") return httpGet(LIVE_URL);
  return readFileSync(fileURLToPath(new URL("./__fixtures__/deltas.html", import.meta.url)), "utf8");
}

export const deltasAdapter: Adapter = {
  name: "deltas",
  async run(): Promise<IngestSummary> {
    const summary: IngestSummary = { upserts: { projects: 0 }, skipped: [] };
    const html = await loadHtml();
    const projects = parseDeltas(html);
    for (const proj of projects) {
      try {
        await upsertProject(proj, SOURCE);
        summary.upserts.projects++;
      } catch (err) {
        summary.skipped.push(`consortium "${proj.title}": ${String(err)}`);
      }
    }
    return summary;
  },
};
```

- [ ] **Step 7: Register the adapter in the runner**

In `apps/api/src/ingest/runner.ts`, add to `ADAPTER_MODULES`:
```ts
  deltas: () => import("./deltas.js") as Promise<{ deltasAdapter: Adapter }>,
```

- [ ] **Step 8: Verify typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS (all tests including the two new DELTAS parser tests).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/ingest/__fixtures__/deltas.html apps/api/src/ingest/deltas-normalize.ts apps/api/src/ingest/deltas-normalize.test.ts apps/api/src/ingest/deltas.ts apps/api/src/ingest/runner.ts
git commit -m "feat(ingest): DELTAS Africa structural adapter (scrape)"
```

---

## Task 5: DS-I Africa adapter

**Files:**
- Create: `apps/api/src/ingest/__fixtures__/dsi-africa.html` (real snapshot)
- Create: `apps/api/src/ingest/dsi-africa-normalize.ts`
- Test: `apps/api/src/ingest/dsi-africa-normalize.test.ts`
- Create: `apps/api/src/ingest/dsi-africa.ts`
- Modify: `apps/api/src/ingest/runner.ts`

**Interfaces:**
- Produces: `parseDsiAfrica(html: string): ProjectUpsert[]`; `dsiAfricaAdapter: Adapter`.

- [ ] **Step 1: Capture the real snapshot**

From `apps/api/`:
```bash
curl -sL -A "research-atlas-ingest" "https://dsi-africa.org/research-hubs" -o src/ingest/__fixtures__/dsi-africa.html
```
If that exact path 404s, capture the DS-I Africa hubs/projects listing page that lists the research hubs with their PIs and institutions (use WebFetch and save the markup). **Read the saved file** and note the real hub titles, PI names, and partner institutions before writing selectors. Note the exact URL captured in a comment at the top of `dsi-africa.ts`. Aim for a fixture that shares at least one institution with the DELTAS fixture (e.g. University of Ghana / University of Cape Town / KEMRI) — that shared org is the cross-source proof; if none overlaps, ensure the DELTAS fixture's lead orgs include one that genuinely appears among DS-I partner institutions.

- [ ] **Step 2: Write the failing parser test**

Create `apps/api/src/ingest/dsi-africa-normalize.test.ts` (adjust expected hub names to the captured snapshot):
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseDsiAfrica } from "./dsi-africa-normalize.js";

const html = readFileSync(fileURLToPath(new URL("./__fixtures__/dsi-africa.html", import.meta.url)), "utf8");

test("parseDsiAfrica extracts hubs with programme, PI and partner institutions", () => {
  const projects = parseDsiAfrica(html);
  assert.ok(projects.length >= 1, "at least one hub parsed");
  for (const p of projects) {
    assert.equal(p.programName, "DS-I Africa");
    assert.ok(p.title.length > 0);
    assert.ok(p.sourceUrl.startsWith("http"));
  }
});

test("parseDsiAfrica surfaces partner institutions for resolution", () => {
  const projects = parseDsiAfrica(html);
  const withPartners = projects.filter((p) => p.partners.length > 0 || p.leadOrg);
  assert.ok(withPartners.length >= 1, "at least one hub has an institution");
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test 2>&1 | grep -A2 dsi`
Expected: FAIL — cannot find module `./dsi-africa-normalize.js`.

- [ ] **Step 4: Implement the parser**

Create `apps/api/src/ingest/dsi-africa-normalize.ts` (same shape as DELTAS; **confirm selectors against the real `dsi-africa.html`**):
```ts
import { parse } from "node-html-parser";
import type { OrgUpsert, PersonUpsert, ProjectUpsert } from "./types.js";

const PROGRAMME = "DS-I Africa";
const BASE = "https://dsi-africa.org";

function org(name: string): OrgUpsert {
  return {
    name: name.trim(),
    shortName: null,
    orgType: "university",
    country: null,
    website: null,
    rorId: null,
    sourceUrl: BASE,
  };
}

function person(fullName: string, sourceUrl: string): PersonUpsert {
  return {
    fullName: fullName.trim(),
    orcid: null,
    openalexAuthorId: null,
    specializations: [],
    worksCount: null,
    lastActiveYear: null,
    primaryOrgRor: null,
    sourceUrl,
  };
}

/**
 * Parse the DS-I Africa research-hub listing into normalised projects. Each hub
 * yields: title, PI, and partner institutions. Selectors MUST match the committed
 * snapshot — confirm against __fixtures__/dsi-africa.html and adjust.
 */
export function parseDsiAfrica(html: string): ProjectUpsert[] {
  const root = parse(html);
  const cards = root.querySelectorAll(".hub, .views-row, .project, article");
  const out: ProjectUpsert[] = [];
  for (const card of cards) {
    const title = card.querySelector("h2, h3, .title")?.text.trim();
    if (!title) continue;
    const piName = card.querySelector(".pi, .lead, .investigator")?.text.trim();
    const href = card.querySelector("a")?.getAttribute("href") ?? "";
    const sourceUrl = href.startsWith("http") ? href : `${BASE}${href}`;
    const institutions = card
      .querySelectorAll(".institution, .partner, .affiliation")
      .map((n) => n.text.trim())
      .filter(Boolean);
    out.push({
      title,
      programName: PROGRAMME,
      country: null,
      leadOrg: institutions[0] ? org(institutions[0]) : null,
      pi: piName ? person(piName, sourceUrl) : null,
      partners: institutions.map((name, i) => ({ org: org(name), role: i === 0 ? "lead" : "partner" })),
      members: [],
      sourceUrl,
    });
  }
  return out;
}
```
Run `pnpm test 2>&1 | grep -A4 dsi` and **edit selectors until both tests pass**.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test 2>&1 | grep -A4 dsi`
Expected: PASS (2 DS-I tests).

- [ ] **Step 6: Write the adapter**

Create `apps/api/src/ingest/dsi-africa.ts`:
```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { httpGet } from "./scrape-http.js";
import { parseDsiAfrica } from "./dsi-africa-normalize.js";
import { upsertProject } from "./upsert.js";
import type { Adapter, IngestSummary, ProvInput } from "./types.js";

const SOURCE: ProvInput = { source: "dsi-africa", ingestMethod: "scrape" };
const LIVE_URL = "https://dsi-africa.org/research-hubs";

async function loadHtml(): Promise<string> {
  if (process.env.INGEST_LIVE === "1") return httpGet(LIVE_URL);
  return readFileSync(fileURLToPath(new URL("./__fixtures__/dsi-africa.html", import.meta.url)), "utf8");
}

export const dsiAfricaAdapter: Adapter = {
  name: "dsi-africa",
  async run(): Promise<IngestSummary> {
    const summary: IngestSummary = { upserts: { projects: 0 }, skipped: [] };
    const html = await loadHtml();
    const projects = parseDsiAfrica(html);
    for (const proj of projects) {
      try {
        await upsertProject(proj, SOURCE);
        summary.upserts.projects++;
      } catch (err) {
        summary.skipped.push(`hub "${proj.title}": ${String(err)}`);
      }
    }
    return summary;
  },
};
```

- [ ] **Step 7: Register the adapter**

In `apps/api/src/ingest/runner.ts`, add to `ADAPTER_MODULES`:
```ts
  "dsi-africa": () => import("./dsi-africa.js") as Promise<{ dsiAfricaAdapter: Adapter }>,
```

- [ ] **Step 8: Verify typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS (all tests).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/ingest/__fixtures__/dsi-africa.html apps/api/src/ingest/dsi-africa-normalize.ts apps/api/src/ingest/dsi-africa-normalize.test.ts apps/api/src/ingest/dsi-africa.ts apps/api/src/ingest/runner.ts
git commit -m "feat(ingest): DS-I Africa structural adapter (scrape)"
```

---

## Task 6: Smoke test — prove cross-source resolution end-to-end

**Files:**
- Modify: `apps/api/test/smoke.sh`

**Interfaces:**
- Consumes: the `deltas` and `dsi-africa` adapters via `pnpm ingest`; the existing `/api/people/:id/projects` and `/api/organizations` endpoints.

- [ ] **Step 1: Add both ingests after the seed-consortia ingest**

In `apps/api/test/smoke.sh`, immediately after the existing line:
```bash
( cd "$API" && DATABASE_URL="postgres://$(whoami)@localhost:5432/$DB" pnpm ingest seed-consortia >/dev/null )
```
add:
```bash
# Structural scrape adapters (read committed fixtures — no network).
( cd "$API" && DATABASE_URL="postgres://$(whoami)@localhost:5432/$DB" pnpm ingest deltas >/dev/null )
( cd "$API" && DATABASE_URL="postgres://$(whoami)@localhost:5432/$DB" pnpm ingest dsi-africa >/dev/null )
```

- [ ] **Step 2: Add the cross-source assertions**

In `apps/api/test/smoke.sh`, just before the `echo "### Result..."` line, add (the shared-institution name must match what the fixtures actually contain — set `SHARED_ORG` to that exact name, e.g. `University of Ghana`):
```bash
# --- P6: cross-source entity resolution (real data) ---
SHARED_ORG="University of Ghana"
# (a) the shared institution exists as exactly ONE org row
ORG_COUNT=$(psql -h localhost -p 5432 -d $DB -tAc "select count(*) from organizations where lower(name) = lower('$SHARED_ORG')")
ck "shared org '$SHARED_ORG' resolves to one row" 1 "$ORG_COUNT"
# (b) that org is reachable from projects under TWO different source programmes
ORG_ID=$(psql -h localhost -p 5432 -d $DB -tAc "select id from organizations where lower(name)=lower('$SHARED_ORG') limit 1")
SRC_SPREAD=$(psql -h localhost -p 5432 -d $DB -tAc "
  select count(distinct pr.source) from projects pr
  where pr.lead_org_id = '$ORG_ID'
     or pr.id in (select project_id from project_partners where org_id = '$ORG_ID')")
ck "shared org spans >=2 source programmes" 1 "$([ "${SRC_SPREAD:-0}" -ge 2 ] && echo 1 || echo 0)"
# (c) the hero person gains a consortium from the real DELTAS source
DELTAS_HERO=$(curl -s "$BASE/people/$HERO_ID/projects" | grep -c '"source":"deltas"')
ck "hero person has a deltas-sourced project" 1 "$([ "${DELTAS_HERO:-0}" -ge 1 ] && echo 1 || echo 0)"
```

- [ ] **Step 3: Run the smoke test**

Run (from repo root, requires local Postgres per the script): `apps/api/test/smoke.sh`
Expected: all checks pass, including the three new P6 checks; final line `### Result: N passed, 0 failed`.

If `shared org spans >=2 source programmes` fails, the two fixtures do not actually share an institution — fix by ensuring the captured DELTAS and DS-I snapshots contain one genuinely-common institution (see Task 5 Step 1), not by weakening the assertion.

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/smoke.sh
git commit -m "test(ingest): smoke proves cross-source org + hero person resolution"
```

---

## Self-Review

**Spec coverage:**
- Two scrape adapters with fixture-default / live-flag acquisition → Tasks 4, 5 (+ `scrape-http.ts` in Task 1). ✓
- `node-html-parser` parsing → Tasks 1, 4, 5. ✓
- Shared program/project/edge upserts promoted into `upsert.ts`, `seed-consortia.ts` untouched → Task 3. ✓
- Person resolver (ORCID > OpenAlex id > name+org, name-only rejected) wired into `upsertPerson` → Tasks 2, 3. ✓
- Org resolution unchanged (ROR → name) → reuses existing `upsertOrg`. ✓
- Provenance on every row (`source`, `scrape` method, source_url, unverified) → Task 3 `prov` param, Tasks 4/5 `SOURCE`. ✓
- Registry/CLI `pnpm ingest dsi-africa|deltas` → Tasks 4/5 Step 7. ✓
- Parser + resolver unit tests; smoke proves org + hero person cross-source → Tasks 2, 4, 5, 6. ✓
- Out of scope (grants/publications, UI, refactor seed-consortia, live in CI) → respected. ✓

**Placeholder scan:** Selector code in Tasks 4/5 is an explicit, runnable template the implementer confirms against the real captured DOM — this is inherent to scraping (the real HTML is only available after capture), not a placeholder; the test asserts the known real records that gate "done". No `TODO`/`TBD`/"handle edge cases" left.

**Type consistency:** `ProjectUpsert`/`MemberEdge`/`PartnerEdge`/`ProvInput` defined in Task 1 are used identically in Tasks 3/4/5. `upsertProject(proj, prov)`, `parseDeltas`/`parseDsiAfrica` signatures match between definition and use. `pickPersonMatch`/`matchPersonToExisting` signatures consistent across Tasks 2/3.
