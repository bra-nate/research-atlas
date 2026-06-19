# Landing Page + Frontend Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Crunchbase-shaped public V1: a real landing page at `/`, a directory that browses every entity type, true global search, and the P8 polish pass — backed by a few read-only aggregate API endpoints.

**Architecture:** Backend adds read-only aggregate endpoints over existing tables (no data mirroring). Frontend adds a landing route, expands directory tabs, adds a global "All" search mode, a left filter rail, skeletons, and an accessibility/responsive pass. The browser only ever calls the Express API.

**Tech Stack:** Express + Drizzle ORM + Postgres (api); Vite + React + TypeScript + React Query + React Router + Tailwind (web); shared `@research-atlas/types`.

## Global Constraints

- TypeScript throughout; enums/shapes mirrored in `@research-atlas/types`, imported by both apps.
- Wire JSON is snake_case (see `serializers.ts`); DB/Drizzle columns are camelCase.
- **No contact data, no auth, no claim, no mutations** — V1 is read-only discovery.
- **Provenance always**: every record keeps `source` + `source_url` + "unverified" label. Do not remove existing provenance rendering.
- **No data mirroring**: new endpoints aggregate over existing rows only.
- API route files use `asyncHandler(...)`, `str(req.query.x)`, `prefixTsQuery`, and `to<Entity>()` serializers. Follow these patterns.
- API verification is `apps/api/test/smoke.sh` (curl-based). Web verification is `pnpm -C apps/web build` (runs `tsc -b`) + manual run. There is no UI test framework — do not add one.
- Design tokens: brand `#0A66FF`, ink `#16181D`, ink-secondary `#667085`, border `#E4E7EC`, surface-alt `#F5F7FA`, tag bg `#EFF1F4`. Blue is the only strong colour. Flat cards, 1px borders, dense layout, tabular figures for counts.

---

## File Structure

**Backend (apps/api):**
- Create `src/routes/stats.ts` — `GET /stats` aggregate counts.
- Modify `src/routes/index.ts` — mount stats router.
- Modify `src/routes/people.ts` — add `consortiaCount` to list; add `GET /people/featured`.
- Modify `src/routes/projects.ts`, `src/routes/organizations.ts`, `src/routes/programs.ts` — `sort=recent` + `limit`.
- Modify `src/serializers.ts` — `toPersonListItem` (person + counts).
- Modify `test/smoke.sh` — assertions for new endpoints.

**Shared types (packages/types):**
- Create `src/stats.ts` — `StatsResponse`.
- Modify `src/edges.ts` (or `people.ts`) — `PersonListItem`.
- Modify `src/index.ts` — export new types.

**Frontend (apps/web):**
- Create `src/routes/landing.tsx` — landing page.
- Modify `src/App.tsx` — routing (`/` = landing, `/directory` retained).
- Modify `src/components/app-shell.tsx` — wordmark → `/`, search scope.
- Modify `src/components/ui.tsx` — skeleton primitives, `ConsortiaChip`.
- Modify `src/index.css` — `prefers-reduced-motion`.
- Modify `src/routes/directory.tsx` — all-entity tabs, filter rail, grouped "All" search.
- Modify `src/lib/api.ts`, `src/lib/hooks.ts` — new endpoints/params/types.

---

## Task 1: Shared types for stats + person list counts

**Files:**
- Create: `packages/types/src/stats.ts`
- Modify: `packages/types/src/people.ts`
- Modify: `packages/types/src/index.ts`

**Interfaces:**
- Produces: `StatsResponse`, `PersonListItem` (consumed by api serializers + web).

- [ ] **Step 1: Create the stats type**

`packages/types/src/stats.ts`:
```ts
/** Aggregate totals for the landing stats banner. Counts of visible rows. */
export interface StatsResponse {
  programmes: number;
  projects: number;
  organizations: number;
  people: number;
  capabilities: number;
  publications: number;
  grants: number;
}
```

- [ ] **Step 2: Add PersonListItem to people.ts**

Append to `packages/types/src/people.ts`:
```ts
/**
 * Person as returned by list/search endpoints — the base Person plus aggregate
 * counts used for the "in N consortia" chip and the cross-consortium hero list.
 */
export interface PersonListItem extends Person {
  consortia_count: number; // distinct programmes this person spans
}
```

- [ ] **Step 3: Export from index.ts**

Add to `packages/types/src/index.ts` (match the existing `export * from "./x.js";` style):
```ts
export * from "./stats.js";
```
(`PersonListItem` is already exported via the existing `export * from "./people.js";`.)

- [ ] **Step 4: Typecheck the types package**

Run: `pnpm -C packages/types build` (or the repo's type-build; if it has no build script, run `pnpm -w tsc -b packages/types`)
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/stats.ts packages/types/src/people.ts packages/types/src/index.ts
git commit -m "feat(types): StatsResponse + PersonListItem"
```

---

## Task 2: `GET /stats` endpoint

**Files:**
- Create: `apps/api/src/routes/stats.ts`
- Modify: `apps/api/src/routes/index.ts`
- Modify: `apps/api/test/smoke.sh`

**Interfaces:**
- Consumes: `db`, schema tables, `asyncHandler`.
- Produces: `GET /api/stats` → `StatsResponse`.

- [ ] **Step 1: Add a failing smoke assertion**

In `apps/api/test/smoke.sh`, after the `GET /publications` line (~line 67), add:
```bash
ck "GET /stats" 200 "$(code "$BASE/stats")"
ck "stats has people count >=1" 1 "$(curl -s "$BASE/stats" | grep -o '"people":[0-9]*' | grep -o '[0-9]*' | head -1 | awk '{print ($1>=1)?1:0}')"
```

- [ ] **Step 2: Run smoke to verify it fails**

Run: `bash apps/api/test/smoke.sh`
Expected: the two new checks FAIL (404 / empty) — the route doesn't exist yet.

- [ ] **Step 3: Create the stats route**

`apps/api/src/routes/stats.ts`:
```ts
import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  capabilities,
  grants,
  organizations,
  people,
  programs,
  projects,
  publications,
} from "../db/schema.js";
import { asyncHandler } from "../http.js";

export const statsRouter = Router();

/** GET /stats — total counts per entity type (visible rows) for the landing banner. */
statsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const count = async (table: Parameters<typeof db.select>[0] extends never ? never : any, where?: unknown) => {
      const q = db.select({ n: sql<number>`count(*)::int` }).from(table);
      const [row] = where ? await (q as any).where(where) : await q;
      return row?.n ?? 0;
    };
    const [programmes, projectsN, organizationsN, peopleN, capabilitiesN, publicationsN, grantsN] =
      await Promise.all([
        count(programs),
        count(projects),
        count(organizations),
        count(people, eq(people.visible, true)),
        count(capabilities),
        count(publications),
        count(grants),
      ]);
    res.json({
      programmes,
      projects: projectsN,
      organizations: organizationsN,
      people: peopleN,
      capabilities: capabilitiesN,
      publications: publicationsN,
      grants: grantsN,
    });
  }),
);
```

> If the `count` helper's typing fights Drizzle, inline each count instead:
> ```ts
> const one = async (t: any, w?: any) => {
>   const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(t).where(w);
>   return r?.n ?? 0;
> };
> ```
> and call `await one(people, eq(people.visible, true))`, `await one(programs)`, etc. Prefer whichever typechecks cleanly.

- [ ] **Step 4: Mount the router**

In `apps/api/src/routes/index.ts`, add the import and mount:
```ts
import { statsRouter } from "./stats.js";
```
```ts
api.use("/stats", statsRouter);
```

- [ ] **Step 5: Run smoke to verify it passes**

Run: `bash apps/api/test/smoke.sh`
Expected: `GET /stats` and `stats has people count >=1` PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/stats.ts apps/api/src/routes/index.ts apps/api/test/smoke.sh
git commit -m "feat(api): GET /stats aggregate counts"
```

---

## Task 3: `consortiaCount` on people list + `GET /people/featured`

**Files:**
- Modify: `apps/api/src/serializers.ts`
- Modify: `apps/api/src/routes/people.ts`
- Modify: `apps/api/test/smoke.sh`

**Interfaces:**
- Consumes: `db`, `people`, `projectMembers`, `projects`, `toPerson`.
- Produces: `toPersonListItem(row, consortiaCount)`; `GET /people` rows now include `consortia_count`; `GET /people/featured?limit=` → `PersonListItem[]`.

- [ ] **Step 1: Add failing smoke assertions**

In `apps/api/test/smoke.sh`, after the `search people q=malaria` line (~line 79), add:
```bash
ck "GET /people/featured" 200 "$(code "$BASE/people/featured")"
ck "people list carries consortia_count" 1 "$(curl -s "$BASE/people" | grep -c 'consortia_count')"
ck "featured returns only multi-consortium people" 1 "$(curl -s "$BASE/people/featured" | grep -o '"consortia_count":[0-9]*' | grep -o '[0-9]*' | awk 'BEGIN{ok=1} {if($1<2)ok=0} END{print ok}')"
```

- [ ] **Step 2: Run smoke to verify it fails**

Run: `bash apps/api/test/smoke.sh`
Expected: the three new checks FAIL.

- [ ] **Step 3: Add the list serializer**

In `apps/api/src/serializers.ts`, after `toPerson`, add:
```ts
import type { PersonListItem } from "@research-atlas/types"; // add to the existing type import block
```
```ts
/** Person plus aggregate counts, for list/search/featured endpoints. */
export function toPersonListItem(
  r: typeof people.$inferSelect,
  consortiaCount: number,
): PersonListItem {
  return { ...toPerson(r), consortia_count: consortiaCount };
}
```

- [ ] **Step 4: Add consortiaCount to the people list query**

In `apps/api/src/routes/people.ts`, update imports and the `GET /` handler. Add `getTableColumns` to the drizzle-orm import:
```ts
import { and, arrayOverlaps, desc, eq, getTableColumns, sql } from "drizzle-orm";
```
Add `toPersonListItem` to the serializer import. Replace the `GET /` handler body's query + response with:
```ts
    const consortiaCount = sql<number>`(
      select count(distinct p.program_id)::int
      from project_members pm
      join projects p on p.id = pm.project_id
      where pm.person_id = ${people.id} and p.program_id is not null
    )`;

    const rows = await db
      .select({ person: getTableColumns(people), consortiaCount })
      .from(people)
      .where(and(...filters))
      .orderBy(people.fullName);
    res.json(rows.map((r) => toPersonListItem(r.person, r.consortiaCount ?? 0)));
```

- [ ] **Step 5: Add the featured route**

In `apps/api/src/routes/people.ts`, add **before** the `/:id` route (so `featured` isn't captured as an id):
```ts
/**
 * GET /people/featured — the cross-consortium hero set: people who span the most
 * distinct programmes (>=2), highest first. Aggregates over project_members.
 */
peopleRouter.get(
  "/featured",
  asyncHandler(async (req, res) => {
    const limitRaw = Number(str(req.query.limit) ?? "6");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 24) : 6;

    const consortiaCount = sql<number>`count(distinct ${projects.programId})::int`;
    const rows = await db
      .select({ person: getTableColumns(people), consortiaCount })
      .from(people)
      .innerJoin(projectMembers, eq(projectMembers.personId, people.id))
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(and(eq(people.visible, true), sql`${projects.programId} is not null`))
      .groupBy(people.id)
      .having(sql`count(distinct ${projects.programId}) >= 2`)
      .orderBy(desc(consortiaCount))
      .limit(limit);
    res.json(rows.map((r) => toPersonListItem(r.person, r.consortiaCount ?? 0)));
  }),
);
```

- [ ] **Step 6: Run smoke to verify it passes**

Run: `bash apps/api/test/smoke.sh`
Expected: all three new checks PASS (the seeded hero person spans WACCBIP + SickleGenAfrica + DELTAS ≥ 2 programmes, so featured is non-empty).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/serializers.ts apps/api/src/routes/people.ts apps/api/test/smoke.sh
git commit -m "feat(api): people consortia_count + GET /people/featured"
```

---

## Task 4: `sort=recent` + `limit` on list endpoints

**Files:**
- Modify: `apps/api/src/routes/projects.ts`, `apps/api/src/routes/organizations.ts`, `apps/api/src/routes/programs.ts`, `apps/api/src/routes/people.ts`
- Modify: `apps/api/test/smoke.sh`

**Interfaces:**
- Produces: `?sort=recent&limit=N` on `GET /people`, `/projects`, `/organizations`, `/programs` → `ingested_at DESC`, capped limit.

- [ ] **Step 1: Add a failing smoke assertion**

In `apps/api/test/smoke.sh`, near the other list checks add:
```bash
ck "GET /projects?sort=recent&limit=3 returns <=3" 1 "$([ "$(jqlen "$BASE/projects?sort=recent&limit=3")" -le 3 ] && echo 1 || echo 0)"
```

- [ ] **Step 2: Run smoke to verify it fails**

Run: `bash apps/api/test/smoke.sh`
Expected: FAIL if the seed has >3 projects (limit ignored today). (If the seed has ≤3 projects this check is weak — still add it; the typecheck + manual review covers behaviour.)

- [ ] **Step 3: Add a shared helper**

In `apps/api/src/lib/search.ts`, add:
```ts
/** Parse a capped positive integer limit from a query param. Returns undefined if absent/invalid. */
export function parseLimit(v: unknown, max = 50): number | undefined {
  const n = Number(typeof v === "string" ? v : "");
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(Math.floor(n), max);
}
```

- [ ] **Step 4: Apply to projects.ts**

In `apps/api/src/routes/projects.ts` `GET /` handler, import `parseLimit` from `../lib/search.js`, then replace the query tail:
```ts
    const sort = str(req.query.sort);
    const limit = parseLimit(req.query.limit);
    let qb = db
      .select()
      .from(projects)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(sort === "recent" ? desc(projects.ingestedAt) : projects.title)
      .$dynamic();
    if (limit) qb = qb.limit(limit);
    const rows = await qb;
    res.json(rows.map(toProject));
```
Ensure `desc` is imported (it already is in projects.ts).

- [ ] **Step 5: Apply the same pattern to organizations.ts, programs.ts, people.ts**

For each, import `parseLimit`, read `sort`/`limit`, switch `orderBy` to `desc(<table>.ingestedAt)` when `sort === "recent"`, and append `.limit(limit)` via `.$dynamic()`. For `people.ts` keep the `consortiaCount` select from Task 3 — apply `sort`/`limit` to that same query. Add `desc` to the organizations.ts and programs.ts drizzle imports if missing (people.ts already imports `desc`).

programs.ts `GET /` becomes:
```ts
    const sort = str(req.query.sort);
    const limit = parseLimit(req.query.limit);
    let qb = db
      .select()
      .from(programs)
      .orderBy(sort === "recent" ? desc(programs.ingestedAt) : programs.name)
      .$dynamic();
    if (limit) qb = qb.limit(limit);
    const rows = await qb;
    res.json(rows.map(toProgram));
```

- [ ] **Step 6: Run smoke to verify it passes**

Run: `bash apps/api/test/smoke.sh`
Expected: the recent/limit check PASSES; all prior checks still PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/ apps/api/src/lib/search.ts apps/api/test/smoke.sh
git commit -m "feat(api): sort=recent + limit on list endpoints"
```

---

## Task 5: Web data layer — new endpoints, params, types

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/hooks.ts`

**Interfaces:**
- Consumes: `StatsResponse`, `PersonListItem`.
- Produces: `api.stats()`, `api.peopleFeatured()`, `api.people(...)` returns `PersonListItem[]`, list params `sort`/`limit` on people/projects/organizations/programs; hooks `useStats`, `usePeopleFeatured`, `useProjects`, `usePublicationsSearch`, `useRecent*`.

- [ ] **Step 1: Update api.ts imports and types**

In `apps/web/src/lib/api.ts`, add `PersonListItem`, `StatsResponse` to the type import from `@research-atlas/types`.

- [ ] **Step 2: Update people + add stats/featured in the `api` object**

Replace the People `people:` line and add entries:
```ts
  people: (p?: {
    q?: string;
    specialization?: string;
    organizationId?: string;
    sort?: string;
    limit?: string;
  }) => req<PersonListItem[]>(`/people${qs(p)}`),
  peopleFeatured: (limit = 6) =>
    req<PersonListItem[]>(`/people/featured${qs({ limit: String(limit) })}`),
```
Update `projects:`, `organizations:`, `programs:` signatures to accept optional `sort?: string; limit?: string;` and pass through `qs`. For `programs` (currently no params) change to:
```ts
  programs: (p?: { sort?: string; limit?: string }) => req<Program[]>(`/programs${qs(p)}`),
```
Add:
```ts
  stats: () => req<StatsResponse>("/stats"),
  publications: (p?: { q?: string }) => req<Publication[]>(`/publications${qs(p)}`),
```

- [ ] **Step 3: Update hooks.ts**

Update `usePeople` filters type to include `sort?: string; limit?: string;`. Update `usePrograms` to accept optional params. Add:
```ts
export function useStats() {
  return useQuery({ queryKey: ["stats"], queryFn: () => api.stats() });
}

export function usePeopleFeatured(limit = 6) {
  return useQuery({
    queryKey: ["peopleFeatured", limit],
    queryFn: () => api.peopleFeatured(limit),
  });
}

export function useProjects(filters: { q?: string; programId?: string; country?: string; sort?: string; limit?: string } = {}) {
  return useQuery({ queryKey: ["projects", filters], queryFn: () => api.projects(filters) });
}

export function usePublicationsSearch(q: string) {
  return useQuery({
    queryKey: ["publications", "search", q],
    queryFn: () => api.publications({ q: q || undefined }),
  });
}
```

- [ ] **Step 4: Typecheck the web app**

Run: `pnpm -C apps/web build`
Expected: `tsc -b` passes (the directory still consumes `Person[]`; `PersonListItem extends Person` so existing usages stay valid).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/hooks.ts
git commit -m "feat(web): data layer for stats, featured, recent, publications"
```

---

## Task 6: Skeleton primitives + reduced-motion

**Files:**
- Modify: `apps/web/src/components/ui.tsx`
- Modify: `apps/web/src/index.css`

**Interfaces:**
- Produces: `Skeleton`, `SkeletonCard`, `SkeletonRows`, `ConsortiaChip` exported from `ui.tsx`.

- [ ] **Step 1: Add skeleton + chip components**

Append to `apps/web/src/components/ui.tsx`:
```tsx
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-surface-alt motion-reduce:animate-none", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border p-4">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** "in N consortia" — the cross-consortium hero teaser. Prominent at >=2. */
export function ConsortiaChip({ count }: { count: number }) {
  if (count < 1) return null;
  const strong = count >= 2;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        strong ? "bg-brand-subtle text-brand" : "bg-tag text-tag-ink",
      )}
      title={strong ? "Appears across multiple consortia" : undefined}
    >
      in {count} {count === 1 ? "consortium" : "consortia"}
    </span>
  );
}
```
> Confirm `cn` is already imported in `ui.tsx`. If `bg-brand-subtle`/`text-tag-ink` tokens don't exist, use `bg-[#EAF1FF] text-brand` and `bg-tag text-[#344054]` to match `tailwind.config.ts`.

- [ ] **Step 2: Add reduced-motion guard to index.css**

Append to `apps/web/src/index.css`:
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm -C apps/web build`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui.tsx apps/web/src/index.css
git commit -m "feat(web): skeleton primitives, ConsortiaChip, reduced-motion"
```

---

## Task 7: Routing + AppShell (landing route, scope-aware search)

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/app-shell.tsx`

**Interfaces:**
- Produces: `/` renders `LandingPage` (created in Task 8 — a stub here first); header search submits `/directory?tab=<scope>&q=<term>`; wordmark → `/`.

- [ ] **Step 1: Create a minimal landing stub so routing compiles**

Create `apps/web/src/routes/landing.tsx`:
```tsx
export function LandingPage() {
  return <div className="text-sm text-ink-secondary">Landing — filled in Task 8.</div>;
}
```

- [ ] **Step 2: Wire routes in App.tsx**

Edit `apps/web/src/App.tsx`: import `LandingPage`, add the root route, point catch-all at `/`:
```tsx
import { LandingPage } from "./routes/landing";
```
```tsx
      <Route path="/" element={shell(<LandingPage />)} />
      <Route path="/directory" element={shell(<DirectoryPage />)} />
```
```tsx
      <Route path="*" element={<Navigate to="/" replace />} />
```

- [ ] **Step 3: Scope-aware search in app-shell.tsx**

Edit `apps/web/src/components/app-shell.tsx`. Add a scope `<select>` before the search input and include it in the submit. Wordmark `Link` already targets `/directory` — change to `/`:
```tsx
  const [scope, setScope] = useState("all");
```
```tsx
  function onSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (scope !== "all") params.set("tab", scope);
    if (q.trim()) params.set("q", q.trim());
    const qsStr = params.toString();
    navigate(`/directory${qsStr ? `?${qsStr}` : ""}`);
  }
```
In JSX, change `<Link to="/directory"` → `<Link to="/"`. Inside the `<form>`, before the input add:
```tsx
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              aria-label="Search scope"
              className="absolute left-1 top-1/2 hidden -translate-y-1/2 rounded-md bg-transparent py-1 pl-2 pr-1 text-xs text-ink-secondary sm:block"
            >
              <option value="all">All</option>
              <option value="programmes">Programmes</option>
              <option value="projects">Projects</option>
              <option value="organizations">Organisations</option>
              <option value="people">People</option>
              <option value="capabilities">Capabilities</option>
              <option value="publications">Publications</option>
            </select>
```
Adjust the input's left padding so the icon/select don't overlap (e.g. `pl-9` → `pl-24 sm:pl-28` when the select is visible; keep the `Search` icon or drop it in favour of the select — pick one to avoid overlap). Update placeholder to `Search the African research ecosystem…` and `aria-label` to `Search programmes, projects, organisations, people, capabilities, publications`.

- [ ] **Step 4: Typecheck + manual smoke**

Run: `pnpm -C apps/web build`
Expected: passes. Manually: `/` shows the stub, `/directory` shows the directory, header search routes with `tab`/`q`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/app-shell.tsx apps/web/src/routes/landing.tsx
git commit -m "feat(web): landing route + scope-aware global search"
```

---

## Task 8: Landing page

**Files:**
- Modify: `apps/web/src/routes/landing.tsx`

**Interfaces:**
- Consumes: `useStats`, `usePeopleFeatured`, `useProjects` (recent), `usePrograms`; `EntityLink`, `Card`, `Tag`, `ConsortiaChip`, `Skeleton`, `SkeletonRows`, `IllustrativeBadge`.

- [ ] **Step 1: Implement the landing page**

Replace `apps/web/src/routes/landing.tsx` with:
```tsx
import { useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import {
  usePeopleFeatured,
  usePrograms,
  useProjects,
  useStats,
} from "../lib/hooks";
import {
  Card,
  ConsortiaChip,
  EntityLink,
  IllustrativeBadge,
  Skeleton,
  SkeletonRows,
  Tag,
} from "../components/ui";

const SCOPES = [
  { value: "all", label: "All" },
  { value: "programmes", label: "Programmes" },
  { value: "projects", label: "Projects" },
  { value: "organizations", label: "Organisations" },
  { value: "people", label: "People" },
  { value: "capabilities", label: "Capabilities" },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("all");

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (scope !== "all") params.set("tab", scope);
    if (q.trim()) params.set("q", q.trim());
    const s = params.toString();
    navigate(`/directory${s ? `?${s}` : ""}`);
  }

  return (
    <div className="space-y-10">
      <Hero q={q} setQ={setQ} scope={scope} setScope={setScope} onSearch={onSearch} />
      <StatsBanner />
      <FeaturedPeople />
      <RecentlyAdded />
      <BrowseTiles />
      <LandingFooter />
    </div>
  );
}

function Hero({
  q,
  setQ,
  scope,
  setScope,
  onSearch,
}: {
  q: string;
  setQ: (v: string) => void;
  scope: string;
  setScope: (v: string) => void;
  onSearch: (e: FormEvent) => void;
}) {
  return (
    <section className="py-8 sm:py-12">
      <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        The map of the African research ecosystem
      </h1>
      <p className="mt-3 max-w-2xl text-base text-ink-secondary">
        Discover programmes, consortia, organisations, the people behind them, their
        funding and their publications — aggregated from public sources, free to browse.
      </p>
      <form onSubmit={onSearch} className="mt-6 max-w-2xl">
        <div
          role="radiogroup"
          aria-label="Search scope"
          className="mb-2 flex flex-wrap gap-1"
        >
          {SCOPES.map((s) => (
            <button
              type="button"
              key={s.value}
              role="radio"
              aria-checked={scope === s.value}
              onClick={() => setScope(s.value)}
              className={
                "rounded-full px-3 py-1 text-sm " +
                (scope === s.value
                  ? "bg-brand text-white"
                  : "bg-tag text-ink-secondary hover:text-ink")
              }
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search the directory"
            placeholder="Search organisations, people, programmes…"
            className="flex-1 rounded-lg border border-border bg-white px-4 py-3 text-base text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Search
          </button>
        </div>
      </form>
    </section>
  );
}

function StatsBanner() {
  const stats = useStats();
  const items: { label: string; key: keyof NonNullable<typeof stats.data> }[] = [
    { label: "People", key: "people" },
    { label: "Programmes", key: "programmes" },
    { label: "Projects", key: "projects" },
    { label: "Organisations", key: "organizations" },
    { label: "Publications", key: "publications" },
  ];
  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-5">
      {items.map((it) => (
        <div key={it.key} className="bg-white px-4 py-4 text-center">
          <div className="text-2xl font-semibold tabular-nums text-ink">
            {stats.data ? stats.data[it.key].toLocaleString() : <Skeleton className="mx-auto h-7 w-16" />}
          </div>
          <div className="mt-1 text-xs text-ink-secondary">{it.label}</div>
        </div>
      ))}
    </section>
  );
}

function SectionHeading({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
      {href && (
        <EntityLink to={href} className="text-sm">
          See all
        </EntityLink>
      )}
    </div>
  );
}

function FeaturedPeople() {
  const featured = usePeopleFeatured(6);
  return (
    <section>
      <SectionHeading title="People across multiple consortia" href="/directory?tab=people" />
      {featured.isLoading ? (
        <SkeletonRows count={4} />
      ) : !featured.data?.length ? (
        <Card className="p-6 text-sm text-ink-secondary">
          No multi-consortium people surfaced yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {featured.data.map((p) => (
            <Card key={p.id} className="p-4 transition-shadow hover:shadow-[0_1px_4px_rgba(16,24,40,.08)]">
              <div className="flex items-start justify-between gap-2">
                <EntityLink to={`/people/${p.id}`} className="text-[15px]">
                  {p.full_name}
                </EntityLink>
                <IllustrativeBadge status={p.verification_status} />
              </div>
              <div className="mt-1 text-xs text-ink-secondary">
                {[p.title, p.highest_qualification].filter(Boolean).join(" · ")}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <ConsortiaChip count={p.consortia_count} />
                {p.specializations.slice(0, 2).map((s) => (
                  <Tag key={s}>{s}</Tag>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentlyAdded() {
  const recent = useProjects({ sort: "recent", limit: "6" });
  return (
    <section>
      <SectionHeading title="Recently added projects" href="/directory?tab=projects" />
      {recent.isLoading ? (
        <SkeletonRows count={4} />
      ) : !recent.data?.length ? (
        <Card className="p-6 text-sm text-ink-secondary">Nothing recent to show.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {recent.data.map((pr) => (
            <Card key={pr.id} className="p-4">
              <EntityLink to={`/projects/${pr.id}`} className="text-[15px]">
                {pr.title}
              </EntityLink>
              <div className="mt-1 flex flex-wrap gap-1">
                {pr.themes.slice(0, 3).map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function BrowseTiles() {
  const tiles = [
    { label: "Programmes", tab: "programmes" },
    { label: "Projects", tab: "projects" },
    { label: "Organisations", tab: "organizations" },
    { label: "People", tab: "people" },
    { label: "Capabilities", tab: "capabilities" },
  ];
  return (
    <section>
      <SectionHeading title="Browse the directory" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((t) => (
          <EntityLink
            key={t.tab}
            to={`/directory?tab=${t.tab}`}
            className="rounded-xl border border-border px-4 py-6 text-center text-sm font-medium hover:border-brand"
          >
            {t.label}
          </EntityLink>
        ))}
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-border pt-6 text-xs text-ink-secondary">
      <p>
        Research Atlas is a public, read-only directory aggregated from public sources.
        Every record links back to its source and is labelled “unverified” until claimed.
        No contact details are shown.
      </p>
    </footer>
  );
}
```
> If `brand-hover` isn't a Tailwind token, use `hover:bg-[#0A4FCC]` (matches `tailwind.config.ts`). Confirm `EntityLink` accepts `className`; if it renders a `react-router` `Link`, it does. If `EntityLink` only accepts entity props, use a plain `<Link>` for the tiles/See-all.

- [ ] **Step 2: Typecheck + manual run**

Run: `pnpm -C apps/web build`
Expected: passes. Then run the app (Task 13 covers the full run) and confirm `/` shows hero, stats, featured people with chips, recent projects, tiles, footer.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/landing.tsx
git commit -m "feat(web): Crunchbase-style landing page"
```

---

## Task 9: Directory browses all entity types

**Files:**
- Modify: `apps/web/src/routes/directory.tsx`

**Interfaces:**
- Consumes: `useProjects`, `usePrograms`, `usePublicationsSearch` (+ existing org/people/capability hooks).
- Produces: tabs `programmes | projects | organizations | people | capabilities | publications`; `ProgrammesList`, `ProjectsList`, `PublicationsList`.

- [ ] **Step 1: Expand the Tab union and TABS**

In `directory.tsx`:
```tsx
type Tab =
  | "programmes"
  | "projects"
  | "organizations"
  | "people"
  | "capabilities"
  | "publications";

const TABS: { id: Tab; label: string }[] = [
  { id: "programmes", label: "Programmes" },
  { id: "projects", label: "Projects" },
  { id: "organizations", label: "Organisations" },
  { id: "people", label: "People" },
  { id: "capabilities", label: "Capabilities" },
  { id: "publications", label: "Publications" },
];

const TAB_IDS = TABS.map((t) => t.id);
const isTab = (v: string | null): v is Tab => !!v && (TAB_IDS as string[]).includes(v);
```
Change the default tab from `"organizations"` to keep `"organizations"` (sensible landing default) — i.e. `isTab(...) ? ... : "organizations"`.

- [ ] **Step 2: Render the new lists**

Add to the tab switch in `DirectoryPage`:
```tsx
      {tab === "programmes" && <ProgrammesList q={q} />}
      {tab === "projects" && <ProjectsList q={q} />}
      {tab === "publications" && <PublicationsList q={q} />}
```

- [ ] **Step 3: Implement the three list components**

Add to `directory.tsx`:
```tsx
function ProgrammesList({ q }: { q: string }) {
  const programs = usePrograms();
  const ql = q.toLowerCase();
  const rows = (programs.data ?? []).filter(
    (p) => !ql || p.name.toLowerCase().includes(ql) || (p.short_name ?? "").toLowerCase().includes(ql),
  );
  if (programs.isLoading) return <SkeletonRows />;
  if (!rows.length) return <Empty>No programmes match your search.</Empty>;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {rows.map((p) => (
        <Card key={p.id} className="p-4 transition-shadow hover:shadow-[0_1px_4px_rgba(16,24,40,.08)]">
          <EntityLink to={`/programs/${p.id}`} className="text-[15px]">
            {p.name}
          </EntityLink>
          {p.short_name && <span className="ml-2 text-xs text-ink-secondary">{p.short_name}</span>}
          {p.focus_areas.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {p.focus_areas.slice(0, 4).map((f) => (
                <Tag key={f}>{f}</Tag>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function ProjectsList({ q }: { q: string }) {
  const projects = useProjects({ q: q || undefined });
  if (projects.isLoading) return <SkeletonRows />;
  if (!projects.data?.length) return <Empty>No projects match your search.</Empty>;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {projects.data.map((pr) => (
        <Card key={pr.id} className="p-4 transition-shadow hover:shadow-[0_1px_4px_rgba(16,24,40,.08)]">
          <EntityLink to={`/projects/${pr.id}`} className="text-[15px]">
            {pr.title}
          </EntityLink>
          <div className="mt-1 text-xs text-ink-secondary">
            {[pr.status, pr.country].filter(Boolean).join(" · ")}
          </div>
          {pr.themes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {pr.themes.slice(0, 4).map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function PublicationsList({ q }: { q: string }) {
  const pubs = usePublicationsSearch(q);
  if (pubs.isLoading) return <SkeletonRows />;
  if (!pubs.data?.length) return <Empty>No publications match your search.</Empty>;
  return (
    <div className="grid grid-cols-1 gap-3">
      {pubs.data.map((pub) => (
        <Card key={pub.id} className="p-4">
          <EntityLink to={`/publications/${pub.id}`} className="text-[15px]">
            {pub.title}
          </EntityLink>
          <div className="mt-1 text-xs text-ink-secondary">
            {[pub.journal, pub.publication_date].filter(Boolean).join(" · ")}
          </div>
        </Card>
      ))}
    </div>
  );
}
```
Add the needed imports (`useProjects`, `usePublicationsSearch`, `SkeletonRows`) at the top of `directory.tsx`. Replace the existing `<Empty>Loading …</Empty>` calls in `OrganizationsList`/`PeopleList`/`CapabilitiesList` with `<SkeletonRows />`.

- [ ] **Step 4: Typecheck + manual run**

Run: `pnpm -C apps/web build`
Expected: passes. Manually confirm Programmes/Projects/Publications tabs load and link out.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/directory.tsx
git commit -m "feat(web): directory browses programmes, projects, publications"
```

---

## Task 10: Left filter rail

**Files:**
- Modify: `apps/web/src/routes/directory.tsx`

**Interfaces:**
- Consumes: `useOrganizationFacets`, `usePeopleFacets` (add hook), `useCapabilityFacets` (add hook if endpoint exists).
- Produces: a two-column directory layout with a per-tab `FilterRail` and "Clear all".

- [ ] **Step 1: Add missing facet hooks**

In `apps/web/src/lib/api.ts` add (capabilities facets endpoint exists per the API):
```ts
  capabilityFacets: () => req<{ categories: string[] }>("/capabilities/facets"),
```
In `hooks.ts` add:
```ts
export function usePeopleFacets() {
  return useQuery({ queryKey: ["peopleFacets"], queryFn: () => api.peopleFacets() });
}
export function useCapabilityFacets() {
  return useQuery({ queryKey: ["capabilityFacets"], queryFn: () => api.capabilityFacets() });
}
```

- [ ] **Step 2: Lift filter state and wrap in two columns**

In `DirectoryPage`, manage filters for all tabs (`country`, `orgType`, `specialization`, `kind`/`category`, `programId`) in state, and render:
```tsx
  return (
    <div className="space-y-5">
      {/* header + tabs unchanged */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
        <aside className="space-y-4">
          <FilterRail tab={tab} filters={filters} setFilters={setFilters} />
        </aside>
        <div>
          <div className="mb-4">
            <Input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the directory" placeholder="Search…" className="max-w-md" />
          </div>
          {/* tab list switch — pass filters down */}
        </div>
      </div>
    </div>
  );
```
Pass relevant filters into each list (e.g. `OrganizationsList` keeps `country`/`orgType`; `PeopleList` gains `specialization`; `CapabilitiesList` gains `kind`/`category`; `ProjectsList` gains `programId`/`country`). Update those hooks' filter args accordingly (the API already supports these params).

- [ ] **Step 3: Implement FilterRail**

```tsx
function FilterRail({
  tab,
  filters,
  setFilters,
}: {
  tab: Tab;
  filters: Record<string, string>;
  setFilters: (f: Record<string, string>) => void;
}) {
  const orgFacets = useOrganizationFacets();
  const peopleFacets = usePeopleFacets();
  const capFacets = useCapabilityFacets();
  const programs = usePrograms();
  const set = (k: string, v: string) => setFilters({ ...filters, [k]: v });
  const active = Object.values(filters).some(Boolean);
  const sel = "w-full rounded-lg border border-border bg-white px-2.5 py-2 text-sm text-ink";

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Filters</span>
        {active && (
          <button type="button" onClick={() => setFilters({})} className="text-xs text-brand hover:underline">
            Clear all
          </button>
        )}
      </div>
      <div className="space-y-3">
        {tab === "organizations" && (
          <>
            <select className={sel} value={filters.country ?? ""} onChange={(e) => set("country", e.target.value)}>
              <option value="">All countries</option>
              {orgFacets.data?.countries.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className={sel} value={filters.orgType ?? ""} onChange={(e) => set("orgType", e.target.value)}>
              <option value="">All types</option>
              {orgFacets.data?.orgTypes.map((t) => <option key={t} value={t}>{ORG_TYPE_LABELS[t as OrgType] ?? t}</option>)}
            </select>
          </>
        )}
        {tab === "people" && (
          <select className={sel} value={filters.specialization ?? ""} onChange={(e) => set("specialization", e.target.value)}>
            <option value="">All specialisations</option>
            {peopleFacets.data?.specializations.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
        {tab === "capabilities" && (
          <select className={sel} value={filters.category ?? ""} onChange={(e) => set("category", e.target.value)}>
            <option value="">All categories</option>
            {capFacets.data?.categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
        {tab === "projects" && (
          <select className={sel} value={filters.programId ?? ""} onChange={(e) => set("programId", e.target.value)}>
            <option value="">All programmes</option>
            {programs.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {(tab === "programmes" || tab === "publications") && (
          <p className="text-xs text-ink-secondary">No filters for this type yet.</p>
        )}
      </div>
    </div>
  );
}
```
On mobile the rail stacks above results (the `grid-cols-1` default handles this); optionally wrap `<aside>` content in a `<details>` for a collapse — acceptable to skip for V1.

- [ ] **Step 4: Typecheck + manual run**

Run: `pnpm -C apps/web build`
Expected: passes. Confirm each tab shows the right facets and "Clear all" resets.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/directory.tsx apps/web/src/lib/api.ts apps/web/src/lib/hooks.ts
git commit -m "feat(web): left filter rail with per-tab facets"
```

---

## Task 11: Grouped global "All" search

**Files:**
- Modify: `apps/web/src/routes/directory.tsx`

**Interfaces:**
- Consumes: org/people/projects/programmes/capabilities/publications search hooks.
- Produces: when `tab` is absent and `q` is present, render grouped result sections; each "See all N" switches to that tab preserving `q`.

- [ ] **Step 1: Detect "All" mode**

In `DirectoryPage`, compute:
```tsx
  const rawTab = params.get("tab");
  const allMode = !rawTab && !!q;
```
When `allMode`, render `<AllResults q={q} onTab={setTab} />` instead of the single-tab list (still show the filter rail column, but the rail can show a hint in All mode).

- [ ] **Step 2: Implement AllResults**

```tsx
function AllResults({ q, onTab }: { q: string; onTab: (t: Tab) => void }) {
  const people = usePeople({ q, limit: "4" });
  const orgs = useOrganizations({ q });
  const projects = useProjects({ q: q || undefined, limit: "4" });
  const programs = usePrograms();
  const caps = useCapabilitiesSearch(q);
  const pubs = usePublicationsSearch(q);
  const ql = q.toLowerCase();
  const programRows = (programs.data ?? []).filter((p) => p.name.toLowerCase().includes(ql)).slice(0, 4);

  const groups = [
    { tab: "people" as Tab, title: "People", rows: (people.data ?? []).slice(0, 4).map((p) => ({ id: p.id, to: `/people/${p.id}`, label: p.full_name })) },
    { tab: "organizations" as Tab, title: "Organisations", rows: (orgs.data ?? []).slice(0, 4).map((o) => ({ id: o.id, to: `/organizations/${o.id}`, label: o.name })) },
    { tab: "projects" as Tab, title: "Projects", rows: (projects.data ?? []).slice(0, 4).map((pr) => ({ id: pr.id, to: `/projects/${pr.id}`, label: pr.title })) },
    { tab: "programmes" as Tab, title: "Programmes", rows: programRows.map((p) => ({ id: p.id, to: `/programs/${p.id}`, label: p.name })) },
    { tab: "capabilities" as Tab, title: "Capabilities", rows: (caps.data ?? []).slice(0, 4).map((c) => ({ id: c.id, to: `/capabilities/${c.id}`, label: c.name })) },
    { tab: "publications" as Tab, title: "Publications", rows: (pubs.data ?? []).slice(0, 4).map((pub) => ({ id: pub.id, to: `/publications/${pub.id}`, label: pub.title })) },
  ].filter((g) => g.rows.length > 0);

  if (!groups.length) return <Empty>No results across the directory for “{q}”.</Empty>;
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.tab}>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold text-ink">{g.title}</h2>
            <button type="button" onClick={() => onTab(g.tab)} className="text-sm text-brand hover:underline">
              See all
            </button>
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {g.rows.map((r) => (
              <li key={r.id} className="px-3 py-2">
                <EntityLink to={r.to}>{r.label}</EntityLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```
`setTab` already exists; ensure it sets `tab` while preserving `q` (it copies current params, so `q` is retained).

- [ ] **Step 3: Typecheck + manual run**

Run: `pnpm -C apps/web build`
Expected: passes. From the header in "All" scope, search a common term → grouped sections appear; "See all" switches to the tab with `q` preserved.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/directory.tsx
git commit -m "feat(web): grouped cross-entity 'All' search"
```

---

## Task 12: "in N consortia" chip on person cards

**Files:**
- Modify: `apps/web/src/routes/directory.tsx`

**Interfaces:**
- Consumes: `ConsortiaChip`, `PersonListItem.consortia_count`.

- [ ] **Step 1: Render the chip in PeopleList**

In `directory.tsx` `PeopleList`, within the card meta row (after specializations), add:
```tsx
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <ConsortiaChip count={p.consortia_count} />
            {p.specializations.slice(0, 4).map((s) => (
              <Tag key={s}>{s}</Tag>
            ))}
          </div>
```
(Replace the existing specializations-only block.) `usePeople` now returns `PersonListItem[]`, so `p.consortia_count` is typed. Import `ConsortiaChip`.

- [ ] **Step 2: Typecheck + manual run**

Run: `pnpm -C apps/web build`
Expected: passes. People tab cards show "in N consortia" where N ≥ 1; the hero (Awandare) shows ≥ 2 prominently.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/directory.tsx
git commit -m "feat(web): 'in N consortia' chip on person cards"
```

---

## Task 13: P8 accessibility + responsive polish, final verification

**Files:**
- Modify: `apps/web/src/components/app-shell.tsx` (skip link), `apps/web/src/routes/directory.tsx` (tablist semantics), plus fixes found during the run.

**Interfaces:** none new — polish only.

- [ ] **Step 1: Add a skip-to-content link**

In `app-shell.tsx`, as the first child of the outer `div`:
```tsx
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-brand focus:shadow"
      >
        Skip to content
      </a>
```
Give `<main>` an `id="main"`. If `sr-only` isn't available, add the standard Tailwind `sr-only` utility (it ships with Tailwind by default).

- [ ] **Step 2: Make the directory tabs a proper tablist**

In `directory.tsx`, add `role="tablist"` to the tab container and `role="tab"` + `aria-selected` to each tab button (they already set `aria-current`). Keep keyboard focus order natural.

- [ ] **Step 3: Run the app and verify on desktop + mobile widths**

Use the `run` skill (or `pnpm -C apps/web dev` plus the API). Verify against the spec:
- `/` renders hero, stats banner (real counts), featured people with chips, recent projects, browse tiles, footer.
- Header search in "All" scope → grouped results; scoped search → single tab.
- Directory reaches Programmes and Projects (previously unreachable).
- Filter rail works per tab; "Clear all" resets.
- A multi-consortium person (Awandare) profile reads well; chip shows ≥2.
- Resize to ~375px wide: hero, stats (2-col), cards, and the hero person profile have no horizontal overflow and read cleanly (the LinkedIn/X share target).
- Tab through the page: skip link appears, focus rings visible, no keyboard traps.

Fix any overflow/contrast/focus issues found inline.

- [ ] **Step 4: Full backend smoke + web build**

Run: `bash apps/api/test/smoke.sh && pnpm -C apps/web build`
Expected: smoke prints `0 failed`; web build passes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/app-shell.tsx apps/web/src/routes/directory.tsx
git commit -m "polish(web): skip link, tablist a11y, responsive fixes"
```

---

## Self-Review Notes

- **Spec coverage:** A (stats/featured/recent/consortiaCount) → Tasks 2–4. B1 landing → Tasks 7–8. B2 all-entity directory → Task 9. B3 global search → Tasks 7 + 11. B4 filter rail → Task 10. B5 chip → Tasks 6 + 12. B6 skeletons → Task 6 (+ applied in 8/9). B7 polish → Tasks 6 + 13. Routing change → Task 7.
- **Type consistency:** `PersonListItem` defined in Task 1, produced by `toPersonListItem` (Task 3), consumed by `api.people`/`api.peopleFeatured` (Task 5), rendered via `consortia_count` (Tasks 8, 12). `StatsResponse` defined Task 1 → `api.stats` Task 5 → `useStats` Task 8.
- **Known soft spots flagged inline:** Drizzle `count` typing (Task 2 fallback given), Tailwind token names (`brand-hover`, `brand-subtle`, `tag-ink` — fallbacks given), `EntityLink` className/`Link` usage (Task 8 note). Implementer should verify these against the actual `tailwind.config.ts` and `ui.tsx` at build time.
</content>
</invoke>
