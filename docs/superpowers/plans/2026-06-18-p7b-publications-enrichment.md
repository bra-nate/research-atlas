# P7b — Publications Enrichment (OpenAlex) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich existing graph people with their OpenAlex works → `publications` + `publication_authors` (with `match_confidence`), and link publications to projects by author-membership → `project_publications`.

**Architecture:** A new `enrich` adapter orchestrates two passes — a live-only resolution pass (ORCID-less orgs→ROR, people→OpenAlex ids) and a works pass that pulls each person's works through a fixture-backed seam, normalises them to publications, resolves each authorship to an existing person via the shared `matchPersonToExisting`, and links author-member publications to their projects. No new people are created from co-authors; no bulk org-work pulls.

**Tech Stack:** Node + TypeScript (ESM, `.js` import specifiers), Drizzle ORM over Postgres, OpenAlex API, `node:test` + `tsx`.

## Global Constraints

- TypeScript ESM throughout; **import specifiers end in `.js`** even for `.ts` files.
- Tests use `node:test` + `node:assert/strict`, run via `pnpm test` from `apps/api/`. **Pure functions are unit-tested; DB-touching code is verified by `apps/api/test/smoke.sh`.** Modules that import `../db/client.js` must be imported lazily inside async functions so pure tests don't trip env validation (see `resolve.ts`).
- Enrich **existing entities only — never create a new person from a co-author.**
- **No bulk org-work pulls.** Works are pulled per-person, capped (`ENRICH_WORKS_CAP`, default 50).
- Provenance on every row: `source`, `source_url`, `ingest_method = "enrichment"`, `ingested_at`, `verification_status = "ingested_unverified"`.
- Idempotent: re-running `pnpm ingest enrich` converges (identical counts).
- Author→person matching reuses `resolve.ts` `matchPersonToExisting` (orcid → openalex id → name+org).
- Awandare's real OpenAlex author id is **`A5026031023`** (the committed works fixture is `works.A5026031023.json`).
- All commands run from `apps/api/` unless stated otherwise.

---

## File Structure

- `apps/api/src/ingest/types.ts` — MODIFY: add `PublicationUpsert`, `AuthorshipInput`.
- `apps/api/src/ingest/enrich-normalize.ts` — CREATE: pure `normalizeWork`, `extractAuthorships`.
- `apps/api/src/ingest/enrich-normalize.test.ts` — CREATE: unit tests vs the works fixture.
- `apps/api/src/ingest/openalex-resolve.ts` — CREATE: pure `pickBestAuthor` + live `resolveAuthorToOpenAlex`, `resolveOrgToRor`.
- `apps/api/src/ingest/openalex-resolve.test.ts` — CREATE: `pickBestAuthor` unit tests.
- `apps/api/src/ingest/upsert.ts` — MODIFY: add `upsertPublication`, `upsertPublicationAuthor`, `upsertProjectPublication`.
- `apps/api/src/ingest/http.ts` — MODIFY: `oaPaginate` accepts extra query params (for `select`).
- `apps/api/src/ingest/enrich.ts` — CREATE: the `enrich` adapter (passes + fixture seam).
- `apps/api/src/ingest/runner.ts` — MODIFY: register `enrich`.
- `apps/api/src/ingest/__fixtures__/works.A5026031023.json` — already committed (Awandare works).
- `apps/api/test/smoke.sh` — MODIFY: seed Awandare's OpenAlex id, run `enrich`, assert publications + project_publications + match_confidence.

---

## Task 1: Normalisation types + pure work normaliser

**Files:**
- Modify: `apps/api/src/ingest/types.ts`
- Create: `apps/api/src/ingest/enrich-normalize.ts`
- Test: `apps/api/src/ingest/enrich-normalize.test.ts`

**Interfaces:**
- Produces:
  - `PublicationUpsert { title: string; doi: string | null; openalexId: string | null; journal: string | null; publicationDate: string | null; url: string | null; sourceUrl: string }`
  - `AuthorshipInput { orcid: string | null; openalexAuthorId: string | null; rawName: string; position: number; instRor: string | null }`
  - `normalizeWork(work: unknown): PublicationUpsert | null`
  - `extractAuthorships(work: unknown): AuthorshipInput[]`

- [ ] **Step 1: Add the types**

In `apps/api/src/ingest/types.ts`, append:
```ts
/** Normalized publication (one OpenAlex work). */
export interface PublicationUpsert {
  title: string;
  doi: string | null;
  openalexId: string | null;
  journal: string | null;
  publicationDate: string | null;
  url: string | null;
  sourceUrl: string;
}

/** One authorship on a work, carrying resolution keys for matchPersonToExisting. */
export interface AuthorshipInput {
  orcid: string | null;
  openalexAuthorId: string | null;
  rawName: string;
  position: number;
  instRor: string | null;
}
```

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/ingest/enrich-normalize.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeWork, extractAuthorships } from "./enrich-normalize.js";

const data = JSON.parse(
  readFileSync(fileURLToPath(new URL("./__fixtures__/works.A5026031023.json", import.meta.url)), "utf8"),
);
const work = data.results[0];

test("normalizeWork maps a work to a publication with bare ids", () => {
  const p = normalizeWork(work)!;
  assert.ok(p, "publication produced");
  assert.ok(p.title.length > 0);
  assert.ok(p.openalexId && /^W\d+$/.test(p.openalexId), "bare openalex id");
  if (p.doi) assert.ok(!p.doi.startsWith("http"), "doi is bare (no url prefix)");
  assert.ok(p.sourceUrl.startsWith("https://openalex.org/"));
});

test("normalizeWork returns null when there is no title", () => {
  assert.equal(normalizeWork({ id: "https://openalex.org/W1", title: null }), null);
});

test("extractAuthorships yields 1-based positions and resolution keys, incl. Awandare", () => {
  const auths = extractAuthorships(work);
  assert.ok(auths.length >= 1);
  assert.equal(auths[0].position, 1);
  const awandare = auths.find((a) => a.orcid === "0000-0002-8793-3641");
  assert.ok(awandare, "Awandare authorship present with bare orcid");
  assert.ok(awandare!.openalexAuthorId && /^A\d+$/.test(awandare!.openalexAuthorId), "bare author id");
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --import tsx --test 'src/ingest/enrich-normalize.test.ts' 2>&1 | grep -E "ERR_MODULE|^ℹ (tests|pass|fail)"`
Expected: FAIL — cannot find module `./enrich-normalize.js`.

- [ ] **Step 4: Implement the normaliser**

Create `apps/api/src/ingest/enrich-normalize.ts`:
```ts
import type { AuthorshipInput, PublicationUpsert } from "./types.js";

/** Strip an OpenAlex/ORCID/ROR URL down to its bare id. */
function bareId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.trim().split(/[?#]/)[0].replace(/\/+$/, "").split("/").pop();
  return m || null;
}

interface OAAuthorship {
  author_position?: string;
  author?: { id?: string | null; orcid?: string | null; display_name?: string | null };
  raw_author_name?: string | null;
  institutions?: { ror?: string | null }[];
}
interface OAWork {
  id?: string;
  doi?: string | null;
  title?: string | null;
  publication_date?: string | null;
  primary_location?: { landing_page_url?: string | null; source?: { display_name?: string | null } | null } | null;
  authorships?: OAAuthorship[];
}

/** One OpenAlex work → a normalised publication, or null if it has no title. */
export function normalizeWork(workRaw: unknown): PublicationUpsert | null {
  const w = workRaw as OAWork;
  const title = w.title?.trim();
  if (!title) return null;
  const loc = w.primary_location ?? null;
  return {
    title,
    doi: bareId(w.doi ?? null),
    openalexId: bareId(w.id ?? null),
    journal: loc?.source?.display_name ?? null,
    publicationDate: w.publication_date ?? null,
    url: loc?.landing_page_url ?? (w.doi ?? null),
    sourceUrl: w.id ?? "https://openalex.org",
  };
}

/** All authorships on a work, with 1-based positions and resolution keys. */
export function extractAuthorships(workRaw: unknown): AuthorshipInput[] {
  const w = workRaw as OAWork;
  return (w.authorships ?? []).map((a, i) => ({
    orcid: bareId(a.author?.orcid ?? null),
    openalexAuthorId: bareId(a.author?.id ?? null),
    rawName: (a.raw_author_name ?? a.author?.display_name ?? "").trim(),
    position: i + 1,
    instRor: bareId((a.institutions ?? []).map((x) => x.ror).find((r) => r != null) ?? null),
  }));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --import tsx --test 'src/ingest/enrich-normalize.test.ts' 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ingest/types.ts apps/api/src/ingest/enrich-normalize.ts apps/api/src/ingest/enrich-normalize.test.ts
git commit -m "feat(ingest): pure OpenAlex work→publication normaliser"
```

---

## Task 2: Publication / authorship / project-publication upserts

**Files:**
- Modify: `apps/api/src/ingest/upsert.ts`

**Interfaces:**
- Consumes: `publications`, `publicationAuthors`, `projectPublications` (schema); `PublicationUpsert`, `ProvInput`.
- Produces:
  - `upsertPublication(p: PublicationUpsert, prov: ProvInput): Promise<string>`
  - `upsertPublicationAuthor(publicationId: string, personId: string, position: number, confidence: number, sourceUrl: string, prov: ProvInput): Promise<void>`
  - `upsertProjectPublication(projectId: string, publicationId: string, sourceUrl: string, prov: ProvInput): Promise<void>`

No unit test (DB-touching). Verified by `pnpm typecheck` + smoke (Task 5).

- [ ] **Step 1: Extend the schema import and types import in `upsert.ts`**

In `apps/api/src/ingest/upsert.ts`, add `publications`, `publicationAuthors`, `projectPublications` to the `../db/schema.js` import list, and add `PublicationUpsert` to the `./types.js` type import list.

- [ ] **Step 2: Add `upsertPublication`**

Append to `apps/api/src/ingest/upsert.ts`:
```ts
/** Upsert a publication by openalex_id, then doi, else insert. Returns its id. */
export async function upsertPublication(pub: PublicationUpsert, p: ProvInput): Promise<string> {
  const existing = pub.openalexId
    ? await db.select({ id: publications.id }).from(publications).where(eq(publications.openalexId, pub.openalexId)).limit(1)
    : pub.doi
      ? await db.select({ id: publications.id }).from(publications).where(eq(publications.doi, pub.doi)).limit(1)
      : [];
  const values = {
    title: pub.title,
    doi: pub.doi,
    openalexId: pub.openalexId,
    journal: pub.journal,
    publicationDate: pub.publicationDate,
    url: pub.url,
    ...prov(pub.sourceUrl, p),
  };
  if (existing[0]) {
    await db.update(publications).set(values).where(eq(publications.id, existing[0].id));
    return existing[0].id;
  }
  const [row] = await db.insert(publications).values(values).returning({ id: publications.id });
  return row.id;
}
```

- [ ] **Step 3: Add `upsertPublicationAuthor`**

Append:
```ts
/** Idempotent authorship edge keyed on (publication, person); carries confidence. */
export async function upsertPublicationAuthor(
  publicationId: string,
  personId: string,
  position: number,
  confidence: number,
  sourceUrl: string,
  p: ProvInput,
): Promise<void> {
  const existing = await db
    .select({ id: publicationAuthors.id })
    .from(publicationAuthors)
    .where(sql`publication_id = ${publicationId} and person_id = ${personId}`)
    .limit(1);
  const values = {
    publicationId,
    personId,
    authorPosition: position,
    matchConfidence: String(confidence),
    ...prov(sourceUrl, p),
  };
  if (existing[0]) {
    await db.update(publicationAuthors).set(values).where(eq(publicationAuthors.id, existing[0].id));
    return;
  }
  await db.insert(publicationAuthors).values(values);
}
```

- [ ] **Step 4: Add `upsertProjectPublication`**

Append:
```ts
/** Idempotent project↔publication edge keyed on (project, publication). */
export async function upsertProjectPublication(
  projectId: string,
  publicationId: string,
  sourceUrl: string,
  p: ProvInput,
): Promise<void> {
  const existing = await db
    .select({ id: projectPublications.id })
    .from(projectPublications)
    .where(sql`project_id = ${projectId} and publication_id = ${publicationId}`)
    .limit(1);
  if (existing[0]) return;
  await db.insert(projectPublications).values({ projectId, publicationId, ...prov(sourceUrl, p) });
}
```

- [ ] **Step 5: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ingest/upsert.ts
git commit -m "feat(ingest): publication / authorship / project_publication upserts"
```

---

## Task 3: OpenAlex resolution (pure pickBestAuthor + live lookups)

**Files:**
- Create: `apps/api/src/ingest/openalex-resolve.ts`
- Test: `apps/api/src/ingest/openalex-resolve.test.ts`

**Interfaces:**
- Consumes: `oaGet` from `./http.js` (live only).
- Produces:
  - `interface AuthorCandidate { id: string; worksCount: number; institutionNames: string[] }`
  - `pickBestAuthor(candidates: AuthorCandidate[], orgName: string | null): { openalexAuthorId: string; confidence: number } | null` (PURE)
  - `resolveAuthorToOpenAlex(name: string, orgName: string | null): Promise<{ openalexAuthorId: string; confidence: number } | null>` (live)
  - `resolveOrgToRor(name: string, country: string | null): Promise<string | null>` (live)

- [ ] **Step 1: Write the failing test (pure picker)**

Create `apps/api/src/ingest/openalex-resolve.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickBestAuthor } from "./openalex-resolve.js";

const c = (id: string, worksCount: number, institutionNames: string[]) => ({ id, worksCount, institutionNames });

test("pickBestAuthor chooses the institution-corroborated candidate", () => {
  const m = pickBestAuthor(
    [c("A1", 400, ["University of Cape Town"]), c("A2", 9, ["MIT"])],
    "University of Cape Town",
  );
  assert.deepEqual(m, { openalexAuthorId: "A1", confidence: 0.6 });
});

test("pickBestAuthor prefers higher works_count among institution matches", () => {
  const m = pickBestAuthor(
    [c("A1", 9, ["University of Cape Town"]), c("A2", 426, ["University of Cape Town"])],
    "university of cape town",
  );
  assert.equal(m!.openalexAuthorId, "A2");
});

test("pickBestAuthor returns null when no candidate matches the org", () => {
  assert.equal(pickBestAuthor([c("A1", 400, ["MIT"])], "University of Cape Town"), null);
});

test("pickBestAuthor returns null when org is unknown (cannot corroborate)", () => {
  assert.equal(pickBestAuthor([c("A1", 400, ["MIT"])], null), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test 'src/ingest/openalex-resolve.test.ts' 2>&1 | grep -E "ERR_MODULE|^ℹ (tests|pass|fail)"`
Expected: FAIL — cannot find module `./openalex-resolve.js`.

- [ ] **Step 3: Implement the resolver**

Create `apps/api/src/ingest/openalex-resolve.ts`:
```ts
import { oaGet } from "./http.js";

export interface AuthorCandidate {
  id: string;
  worksCount: number;
  institutionNames: string[];
}

const norm = (s: string) => s.toLowerCase().trim();

/**
 * Choose the OpenAlex author that an in-graph person maps to. Only a candidate
 * whose last-known-institution name matches the person's primary org counts;
 * among those, the highest works_count wins. No org / no match → null (skip),
 * so we never guess an identity. Confidence 0.6 (name+institution, fuzzy).
 */
export function pickBestAuthor(
  candidates: AuthorCandidate[],
  orgName: string | null,
): { openalexAuthorId: string; confidence: number } | null {
  if (!orgName) return null;
  const target = norm(orgName);
  const matches = candidates.filter((c) =>
    c.institutionNames.some((n) => {
      const x = norm(n);
      return x === target || x.includes(target) || target.includes(x);
    }),
  );
  if (!matches.length) return null;
  const best = matches.reduce((a, b) => (b.worksCount > a.worksCount ? b : a));
  return { openalexAuthorId: best.id, confidence: 0.6 };
}

const bareId = (url: string) => url.replace(/\/+$/, "").split("/").pop()!;

/** Live: search OpenAlex authors by name, corroborate by institution. */
export async function resolveAuthorToOpenAlex(
  name: string,
  orgName: string | null,
): Promise<{ openalexAuthorId: string; confidence: number } | null> {
  const res = await oaGet<{ results: Record<string, unknown>[] }>("authors", { search: name, "per-page": "10" });
  const candidates: AuthorCandidate[] = (res.results ?? []).map((a) => ({
    id: bareId((a as { id: string }).id),
    worksCount: ((a as { works_count?: number }).works_count) ?? 0,
    institutionNames: (((a as { last_known_institutions?: { display_name?: string }[] }).last_known_institutions) ?? [])
      .map((i) => i.display_name ?? "")
      .filter(Boolean),
  }));
  return pickBestAuthor(candidates, orgName);
}

/** Live: search OpenAlex institutions by name, return ROR on a close match. */
export async function resolveOrgToRor(name: string, country: string | null): Promise<string | null> {
  const res = await oaGet<{ results: Record<string, unknown>[] }>("institutions", { search: name, "per-page": "5" });
  const target = norm(name);
  for (const i of res.results ?? []) {
    const inst = i as { display_name?: string; ror?: string | null; country_code?: string | null };
    const dn = norm(inst.display_name ?? "");
    if (inst.ror && (dn === target || dn.includes(target) || target.includes(dn))) {
      return bareId(inst.ror);
    }
  }
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test 'src/ingest/openalex-resolve.test.ts' 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ingest/openalex-resolve.ts apps/api/src/ingest/openalex-resolve.test.ts
git commit -m "feat(ingest): OpenAlex author/org resolution (institution-corroborated)"
```

---

## Task 4: The `enrich` adapter (passes + fixture seam)

**Files:**
- Modify: `apps/api/src/ingest/http.ts`
- Create: `apps/api/src/ingest/enrich.ts`
- Modify: `apps/api/src/ingest/runner.ts`

**Interfaces:**
- Consumes: `oaPaginate` (extended), `normalizeWork`/`extractAuthorships`, `matchPersonToExisting` (`./resolve.js`), `upsertPublication`/`upsertPublicationAuthor`/`upsertProjectPublication`, `resolveAuthorToOpenAlex`/`resolveOrgToRor`.
- Produces: `enrichAdapter: Adapter` (name `"enrich"`).

- [ ] **Step 1: Let `oaPaginate` pass extra query params (for `select`)**

In `apps/api/src/ingest/http.ts`, change the `oaPaginate` signature and the `oaGet` call inside it:
```ts
export async function oaPaginate<T>(
  path: string,
  filter: string,
  cap: number,
  extra: Record<string, string> = {},
): Promise<T[]> {
  const out: T[] = [];
  let cursor = "*";
  while (out.length < cap && cursor) {
    const page = await oaGet<{ results: T[]; meta: { next_cursor: string | null } }>(path, {
      filter,
      "per-page": "200",
      cursor,
      ...extra,
    });
    out.push(...page.results);
    cursor = page.meta.next_cursor ?? "";
  }
  return out.slice(0, cap);
}
```

- [ ] **Step 2: Write the `enrich` adapter**

Create `apps/api/src/ingest/enrich.ts`:
```ts
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isNotNull, or, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { organizations, people, projectMembers } from "../db/schema.js";
import { oaPaginate } from "./http.js";
import { normalizeWork, extractAuthorships } from "./enrich-normalize.js";
import { matchPersonToExisting } from "./resolve.js";
import { resolveAuthorToOpenAlex, resolveOrgToRor } from "./openalex-resolve.js";
import {
  upsertProjectPublication,
  upsertPublication,
  upsertPublicationAuthor,
} from "./upsert.js";
import type { Adapter, IngestSummary, ProvInput } from "./types.js";

const SOURCE: ProvInput = { source: "enrichment", ingestMethod: "enrichment" };
const WORKS_CAP = Number(process.env.ENRICH_WORKS_CAP ?? 50);
const LIVE = process.env.INGEST_LIVE === "1";
const WORKS_SELECT = "id,doi,title,publication_date,primary_location,authorships";

/** Live → page OpenAlex by author id; offline → read a committed works fixture. */
async function fetchWorksForAuthor(openalexAuthorId: string): Promise<unknown[]> {
  if (LIVE) {
    return oaPaginate<unknown>("works", `author.id:${openalexAuthorId}`, WORKS_CAP, { select: WORKS_SELECT });
  }
  const path = fileURLToPath(new URL(`./__fixtures__/works.${openalexAuthorId}.json`, import.meta.url));
  if (!existsSync(path)) return [];
  const data = JSON.parse(readFileSync(path, "utf8")) as { results?: unknown[] };
  return (data.results ?? []).slice(0, WORKS_CAP);
}

/** Resolve an authorship's institution ROR to an in-graph org id (or null). */
async function orgIdForRor(ror: string | null): Promise<string | null> {
  if (!ror) return null;
  const [o] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.rorId, ror)).limit(1);
  return o?.id ?? null;
}

export const enrichAdapter: Adapter = {
  name: "enrich",
  async run(): Promise<IngestSummary> {
    const summary: IngestSummary = {
      upserts: { publications: 0, publication_authors: 0, project_publications: 0, resolved_people: 0, resolved_orgs: 0 },
      skipped: [],
    };

    // --- Pass 1: resolution (live only — search responses can't be fixtured). ---
    if (LIVE) {
      const orgs = await db
        .select({ id: organizations.id, name: organizations.name, country: organizations.country })
        .from(organizations)
        .where(sqlNull(organizations.rorId));
      for (const o of orgs) {
        try {
          const ror = await resolveOrgToRor(o.name, o.country);
          if (ror) {
            await db.update(organizations).set({ rorId: ror }).where(eq(organizations.id, o.id));
            summary.upserts.resolved_orgs++;
          }
        } catch (err) {
          summary.skipped.push(`resolve org "${o.name}": ${String(err)}`);
        }
      }

      const unresolved = await db
        .select({ id: people.id, fullName: people.fullName, primaryOrgId: people.primaryOrgId })
        .from(people)
        .where(sqlNoIds());
      for (const p of unresolved) {
        if (!p.primaryOrgId) continue;
        const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, p.primaryOrgId)).limit(1);
        try {
          const hit = await resolveAuthorToOpenAlex(p.fullName, org?.name ?? null);
          if (hit) {
            await db.update(people).set({ openalexAuthorId: hit.openalexAuthorId }).where(eq(people.id, p.id));
            summary.upserts.resolved_people++;
          }
        } catch (err) {
          summary.skipped.push(`resolve author "${p.fullName}": ${String(err)}`);
        }
      }
    }

    // --- Pass 2: works → publications → author-membership links. ---
    const enrichable = await db
      .select({ id: people.id, openalexAuthorId: people.openalexAuthorId })
      .from(people)
      .where(or(isNotNull(people.orcid), isNotNull(people.openalexAuthorId)));

    for (const person of enrichable) {
      const authorId = person.openalexAuthorId;
      if (!authorId) continue; // need an OpenAlex author id to fetch works
      let works: unknown[];
      try {
        works = await fetchWorksForAuthor(authorId);
      } catch (err) {
        summary.skipped.push(`fetch works ${authorId}: ${String(err)}`);
        continue;
      }
      if (works.length === WORKS_CAP) summary.skipped.push(`works capped at ${WORKS_CAP} for ${authorId}`);

      for (const work of works) {
        try {
          const pub = normalizeWork(work);
          if (!pub) continue;
          const pubId = await upsertPublication(pub, SOURCE);
          summary.upserts.publications++;

          const linkedPersonIds = new Set<string>();
          for (const a of extractAuthorships(work)) {
            const orgId = await orgIdForRor(a.instRor);
            const match = await matchPersonToExisting({
              orcid: a.orcid,
              openalexAuthorId: a.openalexAuthorId,
              normalisedName: a.rawName.toLowerCase().trim(),
              orgId,
            });
            if (!match) continue;
            await upsertPublicationAuthor(pubId, match.personId, a.position, match.confidence, pub.sourceUrl, SOURCE);
            summary.upserts.publication_authors++;
            linkedPersonIds.add(match.personId);
          }

          for (const personId of linkedPersonIds) {
            const memberships = await db
              .select({ projectId: projectMembers.projectId })
              .from(projectMembers)
              .where(eq(projectMembers.personId, personId));
            for (const m of memberships) {
              await upsertProjectPublication(m.projectId, pubId, pub.sourceUrl, SOURCE);
              summary.upserts.project_publications++;
            }
          }
        } catch (err) {
          summary.skipped.push(`work for ${authorId}: ${String(err)}`);
        }
      }
    }
    return summary;
  },
};

// Local null/has-id predicates kept tiny and readable.
import { sql } from "drizzle-orm";
function sqlNull(col: unknown) {
  return sql`${col} is null`;
}
function sqlNoIds() {
  return sql`orcid is null and openalex_author_id is null`;
}
```

- [ ] **Step 3: Register the adapter in the runner**

In `apps/api/src/ingest/runner.ts`, add to `ADAPTER_MODULES`:
```ts
  enrich: () => import("./enrich.js") as Promise<{ enrichAdapter: Adapter }>,
```

- [ ] **Step 4: Verify typecheck + existing unit tests still pass**

Run: `pnpm typecheck && pnpm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: typecheck PASS; all unit tests PASS (fail 0).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ingest/http.ts apps/api/src/ingest/enrich.ts apps/api/src/ingest/runner.ts
git commit -m "feat(ingest): enrich adapter — OpenAlex works → publications + project links"
```

---

## Task 5: Smoke test + idempotency

**Files:**
- Modify: `apps/api/test/smoke.sh`

**Interfaces:**
- Consumes: the `enrich` adapter (offline via the works fixture).

- [ ] **Step 1: Give the seeded Awandare his OpenAlex author id**

In `apps/api/test/smoke.sh`, find the raw `insert into people ... 'Gordon Awandare' ...` line and add the `openalex_author_id` column + value `A5026031023`. The current line is:
```bash
insert into people (id,full_name,primary_org_id,specializations,skills,orcid) values ('$PERSON','Gordon Awandare','$ORG','{genomics}','{malaria}','0000-0002-8793-3641');
```
Replace it with:
```bash
insert into people (id,full_name,primary_org_id,specializations,skills,orcid,openalex_author_id) values ('$PERSON','Gordon Awandare','$ORG','{genomics}','{malaria}','0000-0002-8793-3641','A5026031023');
```

- [ ] **Step 2: Run the enrich adapter after the structural ingests**

In `apps/api/test/smoke.sh`, after the `pnpm ingest deltas` line, add:
```bash
# Publications enrichment (offline: reads the committed works fixture for the seeded author id).
( cd "$API" && DATABASE_URL="postgres://$(whoami)@localhost:5432/$DB" pnpm ingest enrich >/dev/null )
```

- [ ] **Step 3: Add the publication assertions**

In `apps/api/test/smoke.sh`, just before the `echo "### Result..."` line, add:
```bash
# --- P7b: publications enrichment ---
PUBS=$(curl -s "$BASE/people/$HERO_ID/publications" | grep -c '"publication"')
ck "hero person has enriched publications" 1 "$([ "${PUBS:-0}" -ge 1 ] && echo 1 || echo 0)"
# the authorship carries a match_confidence (1.0 via ORCID)
MC=$(psql -h localhost -p 5432 -d $DB -tAc "select count(*) from publication_authors where person_id='$HERO_ID' and match_confidence is not null")
ck "authorship carries match_confidence" 1 "$([ "${MC:-0}" -ge 1 ] && echo 1 || echo 0)"
# author-membership linking produced project_publications for a hero consortium
PP=$(psql -h localhost -p 5432 -d $DB -tAc "
  select count(*) from project_publications pp
  join project_members pm on pm.project_id = pp.project_id
  where pm.person_id = '$HERO_ID'")
ck "publications link to hero's projects (author-membership)" 1 "$([ "${PP:-0}" -ge 1 ] && echo 1 || echo 0)"
```

- [ ] **Step 4: Run the smoke test**

Run (from repo root): `bash apps/api/test/smoke.sh 2>&1 | grep -E "✓|✗|### Result"`
Expected: all checks pass including the three new P7b checks; `### Result: N passed, 0 failed`.

- [ ] **Step 5: Verify idempotency (no duplicate publications/edges on re-run)**

Run (from `apps/api/`):
```bash
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
DB=ra_p7b; ROOT="$(cd ../.. && pwd)"
psql -h localhost -p 5432 -d postgres -X -q -c "drop database if exists $DB;"
psql -h localhost -p 5432 -d postgres -X -q -c "create database $DB;"
for f in 0001_init 0002_person_activity_signal 0003_enrichment_edges; do psql -h localhost -p 5432 -d $DB -v ON_ERROR_STOP=1 -X -q -f "$ROOT/supabase/migrations/$f.sql" >/dev/null; done
URL="postgres://$(whoami)@localhost:5432/$DB"
psql -h localhost -p 5432 -d $DB -X -q -c "insert into organizations (id,name,org_type) values ('11111111-1111-1111-1111-111111111111','WACCBIP','university'); insert into people (id,full_name,primary_org_id,orcid,openalex_author_id) values ('22222222-2222-2222-2222-222222222222','Gordon Awandare','11111111-1111-1111-1111-111111111111','0000-0002-8793-3641','A5026031023'); insert into programs (id,name) values ('33333333-3333-3333-3333-333333333333','H3Africa'); insert into projects (id,title,program_id) values ('44444444-4444-4444-4444-444444444444','SickleGenAfrica','33333333-3333-3333-3333-333333333333'); insert into project_members (project_id,person_id,role) values ('44444444-4444-4444-4444-444444444444','22222222-2222-2222-2222-222222222222','pi');" >/dev/null
for run in 1 2; do DATABASE_URL="$URL" pnpm ingest enrich >/dev/null; echo "run $run: pubs=$(psql -h localhost -p 5432 -d $DB -tAc 'select count(*) from publications') pub_authors=$(psql -h localhost -p 5432 -d $DB -tAc 'select count(*) from publication_authors') proj_pubs=$(psql -h localhost -p 5432 -d $DB -tAc 'select count(*) from project_publications')"; done
psql -h localhost -p 5432 -d postgres -X -q -c "drop database if exists $DB;"
```
Expected: run 1 and run 2 print identical `pubs` / `pub_authors` / `proj_pubs` counts (≥ 1 each).

- [ ] **Step 6: Commit**

```bash
git add apps/api/test/smoke.sh
git commit -m "test(ingest): smoke + idempotency for publications enrichment"
```

---

## Self-Review

**Spec coverage:**
- Enrich existing people's works → publications + publication_authors (match_confidence) → Tasks 1, 2, 4. ✓
- Author-membership → project_publications → Task 4 (Pass 2 linking), Task 5 smoke. ✓
- Fixture seam + INGEST_LIVE; ENRICH_WORKS_CAP → Task 4 Step 2 (`fetchWorksForAuthor`, `WORKS_CAP`). ✓
- Pass 1 resolution (live only): orgs→ROR, people→OpenAlex id, institution-corroborated → Tasks 3, 4. ✓
- Reuses `matchPersonToExisting`; only existing people become authors (no new people) → Task 4 (`if (!match) continue`). ✓
- No bulk org-work pulls; per-person cap → Task 4 (per-person loop, `WORKS_CAP`, no org fetch). ✓
- Idempotent (openalex_id/doi; edge tuples) → Tasks 2, 5. ✓
- Provenance `ingest_method="enrichment"` → Task 4 `SOURCE`. ✓
- Unit tests (normalizeWork/extractAuthorships, pickBestAuthor) + smoke (pubs, match_confidence, project_publications) → Tasks 1, 3, 5. ✓
- Out of scope (Crossref, bulk org, UI, grants) → untouched. ✓

**Placeholder scan:** No TODO/TBD; every code step shows complete code; the works fixture is already committed (captured during planning).

**Type consistency:** `PublicationUpsert`/`AuthorshipInput` (Task 1) used identically in Tasks 2/4. `upsertPublication`→`Promise<string>` used for its id in Task 4. `upsertPublicationAuthor(publicationId, personId, position, confidence, sourceUrl, prov)` and `upsertProjectPublication(projectId, publicationId, sourceUrl, prov)` signatures match between Task 2 definitions and Task 4 calls. `pickBestAuthor(candidates, orgName)` and `matchPersonToExisting({orcid, openalexAuthorId, normalisedName, orgId})` consistent with their definitions (Task 3 / existing `resolve.ts`). `matchConfidence` stored as string (Drizzle `numeric`), surfaced as number by the existing serializer.
