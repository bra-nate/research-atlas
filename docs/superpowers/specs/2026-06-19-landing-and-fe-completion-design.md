# Landing Page + Frontend Completion — Design

> Date: 2026-06-19
> Status: Approved (design); pending implementation plan
> Product: Research Atlas (public, read-only directory of the African research ecosystem)

## Goal

Bring the public frontend to a shippable, Crunchbase-shaped V1:

1. A real **landing page** at `/` that frames the product and showcases the hero
   feature (cross-consortium people aggregation), modelled on Crunchbase's home
   (hero search → stats → featured cards → browse → footer).
2. Make the **directory browse every entity type** (Programmes and Projects are
   currently unreachable except via deep links).
3. A **true global search** across entity types.
4. Polish: left filter rail, "in N consortia" chips, skeleton loaders, and the P8
   responsive/accessibility pass.

This is FE-led but requires a few small **read-only aggregate** API endpoints.
No data mirroring — every new endpoint aggregates over existing rows, consistent
with the "enrich existing entities only" rule.

## Non-goals

- No accounts/auth/claim/contact (V1 guardrails unchanged).
- No new ingestion or data mirroring.
- Grants get no top-level browse tab (the list endpoint only filters by funder);
  grants remain reachable via project Funding sections and `/grants/:id`.

## Routing changes

| Route | Before | After |
|-------|--------|-------|
| `/` | redirect → `/directory` | **Landing page** (new) |
| `/directory` | home (directory) | directory / search results (unchanged component, now not the root) |
| catch-all | → `/directory` | → `/` |

AppShell wordmark links to `/`. AppShell global search submits to
`/directory?tab=<scope>&q=<term>`.

## A. Backend — new read endpoints

All in `apps/api/src/routes/*`, Drizzle queries inline, reusing existing
serializers. Mounted in `routes/index.ts`.

### A1. `GET /stats`
New `routes/stats.ts`. Returns total counts per entity type:
```
{ programmes, projects, organizations, people, capabilities, publications, grants }
```
`COUNT(*)` per table (people limited to visible, matching existing visibility rules
used in `/organizations/counts`). Powers the landing stats banner.

### A2. `GET /people/featured?limit=`
Returns people ranked by **distinct programme count desc**, filtered to those in
**≥ 2 distinct programmes** (the cross-consortium hero set). Aggregate:
`project_members → projects → program_id`, count distinct non-null `program_id`.
Response: existing `Person` shape plus `programmeCount` (and `consortiaCount`,
see A4). `limit` defaults to 6, capped (e.g. 24).

### A3. `sort=recent&limit=` on list endpoints
Add optional `sort=recent` (→ `ingested_at DESC`) and `limit` to: `GET /people`,
`GET /projects`, `GET /organizations`, `GET /programs`. Default ordering unchanged
(alphabetical) when `sort` is absent. `limit` capped server-side. Powers
"Recently added".

### A4. `consortiaCount` on `GET /people` list
Add a correlated subquery counting distinct programmes per person to the people
list serialization, so person cards anywhere can render the "in N consortia" chip
without N+1 calls. Field also returned by `/people/featured`.

> Shared types in `/packages/types` updated to mirror new response fields
> (`StatsResponse`, `programmeCount`/`consortiaCount` on Person list rows).

## B. Frontend

### B1. Landing page (`/`) — `routes/landing.tsx`

Top to bottom (Crunchbase-shaped, but using the existing dense/utilitarian tokens):

1. **Hero band** — headline + one-line subhead + a large search input with an
   entity-scope segmented control: All · Programmes · Projects · Organisations ·
   People · Capabilities. Submit → `/directory?tab=<scope>&q=<term>` (scope `all`
   → grouped search, see B3).
2. **Stats banner** — live counts from `/stats`, tabular figures, hairline-separated.
3. **Featured: People across multiple consortia** — cards from `/people/featured`,
   each with name (link), primary org, top specialisations, and the **"in N
   consortia" chip**. This puts the hero feature on the front door.
4. **Recently added** — compact strip/rows from `sort=recent` (mix or a single
   entity type; spec'd as a small set of recently-added people + projects).
5. **Browse by category** — tiles for Programmes, Projects, Organisations, People,
   Capabilities → `/directory?tab=…`.
6. **Footer** — "Public · read-only", provenance framing, brief about line, source
   acknowledgement. (No contact, no sign-in.)

States: each data section has its own skeleton (B6) and a graceful empty fallback.

### B2. Directory browses all types — `routes/directory.tsx`

Tabs become: **Programmes · Projects · Organisations · People · Capabilities ·
Publications**. New `ProgrammesList`, `ProjectsList`, `PublicationsList` result
renderers following the existing card pattern. Tab state stays URL-synced (`?tab=`).

### B3. True global search

Header search and the landing hero support an **"All"** scope. In All mode the
directory renders **grouped result sections** (People, Organisations, Projects,
Programmes, Capabilities, Publications), each showing top-N matches + a "See all
N" link that switches to that entity's tab with the query preserved. A specific
scope behaves like today (single tab). Placeholder copy updated to reflect the
full entity span.

### B4. Left filter rail

Replace inline dropdown facets with a collapsible **left filter rail** in the
directory (two-column: rail + results). Facets wired per active tab:
- Organisations: country, org type
- People: specialisation
- Capabilities: kind, category
- Projects: country, programme
Rail has a "Clear all". On mobile the rail collapses into a "Filters" disclosure
above results.

### B5. "in N consortia" chip

Person cards (directory `PeopleList`, landing featured, grouped search) render a
chip from `consortiaCount` when ≥ 1 (styled prominently when ≥ 2 — the hero teaser).

### B6. Skeleton loaders

Add skeleton primitives to `components/ui.tsx` (`SkeletonText`, `SkeletonCard`,
`SkeletonRow`) matching final layouts. Replace the plain "Loading…" text in
directory lists, landing sections, and profile pages. Honour `prefers-reduced-motion`
(no shimmer animation when reduced).

### B7. P8 polish

- Global `prefers-reduced-motion` handling in `index.css` (disable transitions/
  shimmer; keep instant state changes).
- ARIA pass: segmented control as a proper tablist/radiogroup, search landmarks,
  rail group labelling, skip-to-content.
- Responsive verification: landing + hero person profile read well on a phone
  (the LinkedIn/X share target). Fix any overflow/stacking issues found.

## Component / file impact

New:
- `apps/web/src/routes/landing.tsx`
- `apps/api/src/routes/stats.ts`
- skeleton primitives in `apps/web/src/components/ui.tsx`
- result renderers for programmes/projects/publications (in `directory.tsx` or split out)

Modified:
- `apps/web/src/App.tsx` (routes), `components/app-shell.tsx` (search scope + wordmark)
- `apps/web/src/routes/directory.tsx` (tabs, filter rail, grouped search)
- `apps/web/src/lib/api.ts`, `lib/hooks.ts` (new endpoints/params/types)
- `apps/api/src/routes/{people,projects,organizations,programs}.ts` (sort/limit, consortiaCount)
- `apps/api/src/routes/index.ts` (mount stats)
- `apps/api/src/serializers.ts` (people list count field)
- `packages/types` (new response/field types)

## Testing

- API: unit/integration tests for `/stats` (counts match seed), `/people/featured`
  (only ≥2-programme people, ordered desc), `sort=recent` ordering, and
  `consortiaCount` correctness. Follow existing route test patterns.
- Web: the existing manual/verify flow — landing renders all sections with seed
  data; directory tabs reach Programmes/Projects; global "All" search groups
  results; mobile check on landing + a multi-consortium person.

## Risks / decisions

- **`/` change** could surprise existing deep links to `/directory` — preserved, so
  no breakage; only the root changes.
- **Grouped "All" search** fans out to several endpoints. Mitigate with small
  per-type limits and React Query caching; acceptable for V1 scale.
- **`consortiaCount` subquery** on the people list — verify it doesn't regress list
  latency; index on `project_members.person_id` / join path if needed.
</content>
</invoke>
