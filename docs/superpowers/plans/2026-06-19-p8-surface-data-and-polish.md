# P8 — Surface joined data + polish + ship (plan)

> Execute task-by-task. Each task ends with a verification + commit.

**Goal:** Surface `project_publications` / `project_grants` on the project page,
add P8 polish (last-updated, claim stub, match-confidence label, a11y), and prep
Vercel deploy.

**Tech:** Express + Drizzle (API), Vite/React + React Query + Tailwind (web),
`node:test` (units), `smoke.sh` (e2e).

## Global constraints

- No contact data, no claim action, no auth. Provenance on every record.
- Read existing join rows only — never create entities.
- ESM `.js` import specifiers; rebuild `@research-atlas/types` before api typecheck.

---

### Task A1: API endpoints — project publications & grants

**Files:** Modify `apps/api/src/routes/projects.ts`.

**Produces:**
- `GET /projects/:id/publications` → `{ publication: Publication }[]` (newest first)
- `GET /projects/:id/grants` → `{ grant: Grant; funder: Organization | null }[]`

Join `projectPublications`→`publications` (order by `publicationDate desc`) and
`projectGrants`→`grants` left join `organizations` on `funderOrgId`. Reuse
`toPublication`, `toGrant`, `toOrganization`. Import `projectGrants`,
`projectPublications`, `grants`, `publications` from schema; `desc` from drizzle.

- [ ] Add both handlers after `/:id/partners`.
- [ ] Build types, `pnpm typecheck`.
- [ ] Commit.

### Task A2: Web client + hooks

**Files:** Modify `apps/web/src/lib/api.ts`, `apps/web/src/lib/hooks.ts`.

Add view types:
```ts
export type ProjectPublicationView = { publication: Publication };
export type ProjectGrantView = { grant: Grant; funder: Organization | null };
```
Add `api.projectPublications(id)` / `api.projectGrants(id)`; hooks
`useProjectPublications(id)` / `useProjectGrants(id)` (enabled when id present).

- [ ] Add client + hooks. Typecheck. Commit.

### Task A3: Project page — Outputs + Funding sections

**Files:** Modify `apps/web/src/routes/project.tsx`.

Add `useProjectPublications`/`useProjectGrants`. Render a **Funding** SectionCard
(grant name → `/grants/:id`, amount via `Intl.NumberFormat`, funder link) and an
**Outputs** SectionCard (publication title → `/publications/:id`, journal·date),
matching the person page's Outputs markup and empty states.

- [ ] Add sections. `pnpm build` (web). Commit.

### Task A4: Smoke assertions

**Files:** Modify `apps/api/test/smoke.sh`.

Add checks: `GET /projects/:DSI_PROJ/grants` 200 with ≥1 grant; a project with
author-membership publications returns ≥1 from `/projects/:id/publications`.

- [ ] Add checks. Run `bash apps/api/test/smoke.sh`. Commit.

### Task B1: "Last updated" line

**Files:** Modify `apps/web/src/components/ui.tsx` (add `UpdatedLine` +
`formatUpdated` pure helper), create `apps/web/src/lib/format.test.ts`? — keep
`formatUpdated` in `apps/web/src/lib/format.ts` so it is unit-testable; export
`UpdatedLine` from ui. Render in person/project/org/program rails near
`ProvenanceLine`.

```ts
// format.ts
export function formatUpdated(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Updated ${d.getUTCDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
```

- [ ] Add helper + test + component, wire into 4 pages. Test + build. Commit.

### Task B2: "Is this you? (coming soon)" stub

**Files:** Modify `apps/web/src/components/ui.tsx` (add `ClaimStub`),
`apps/web/src/routes/person.tsx` (render in rail).

Inert: muted RailBlock-style text "Is this you? — profile claiming coming soon".
No link/button.

- [ ] Add + wire. Build. Commit.

### Task B3: match_confidence label

**Files:** Modify `apps/api/src/routes/people.ts` (add `match_confidence` to the
publications payload), `apps/web/src/lib/api.ts` (`PersonPublication` gains
`match_confidence: number | null`), `apps/web/src/routes/person.tsx` (Tag
"possible match" when `match_confidence != null && < 1`).

- [ ] Thread field through. Build types + typecheck + web build. Commit.

### Task B4: Responsive + a11y pass

**Files:** review `project.tsx`, `person.tsx`, `app-shell.tsx`, `profile-layout.tsx`.

Verify external `<a>` have `rel="noreferrer"`; heading order h1→h2→h3; focus
styles on links; the directory grid + TwoColumn collapse at narrow width. Fix any
gaps found.

- [ ] Audit + fixes. Build. Commit.

### Task B5: Vercel deploy prep

**Files:** Create `apps/web/vercel.json` (SPA rewrite to `/index.html`; `/api`
proxy note), document API base env in a short `DEPLOY.md`.

- [ ] Add config + doc. Commit. Hand off the `vercel` auth'd command to the user.
