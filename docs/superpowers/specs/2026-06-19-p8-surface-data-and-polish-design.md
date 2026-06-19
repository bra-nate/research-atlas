# P8 — Surface joined data + polish + ship (design)

**Date:** 2026-06-19

## Problem

P6/P7 wrote new graph edges (`project_grants`, `project_publications`,
`publication_authors.match_confidence`) but the frontend never reads them. The
project profile shows only a `funding_note` string; the person "Outputs" list
shows no match confidence. P8's "Done" — *people/projects show real
publications; hero view reads well on a phone; every record provenance-labelled*
— requires surfacing this data and a final polish pass.

## Scope

Two sequential pieces, one spec.

### A — Surface project publications & grants

**API** (`apps/api/src/routes/projects.ts`), mirroring the existing
`/:id/members` and `people /:id/publications` handlers:

- `GET /projects/:id/publications` — join `project_publications` →
  `publications`, newest first. Response: `{ publication: Publication }[]`.
- `GET /projects/:id/grants` — join `project_grants` → `grants`, left-joined to
  the funder org. Response: `{ grant: Grant; funder: Organization | null }[]`.

**Web** (`apps/web/src/lib/api.ts`, `hooks.ts`, `routes/project.tsx`):

- `api.projectPublications(id)` / `api.projectGrants(id)` client methods + view
  types `ProjectPublicationView` / `ProjectGrantView`.
- `useProjectPublications` / `useProjectGrants` query hooks.
- Project page gains two `SectionCard`s: **Outputs** (publications → `/publications/:id`)
  and **Funding** (grants: name, amount+currency, funder link). `funding_note`
  remains as a rail fallback.

### B — P8 polish

- **"Last updated"** — `UpdatedLine` component formatting `ingested_at`
  ("Updated 19 Jun 2026"), rendered in the rail of person/project/org/program.
- **"Is this you? (coming soon)"** — quiet, non-interactive `ClaimStub` in the
  person rail. No link, no form. V2 signpost only.
- **`match_confidence` label** — person `/:id/publications` payload carries
  `match_confidence`; the Outputs list shows a subtle "possible match" Tag when
  it is non-null and `< 1`.
- **Responsive + a11y** — `TwoColumn` is already `grid-cols-1 lg:grid-cols-[…]`;
  verify it collapses cleanly, check heading order / focus states / external
  link `rel`, and contrast on muted greys.
- **Deploy** — Vercel for the static SPA; the API base is already proxied via
  `/api`. Prep `vercel.json` + env note and hand off the auth'd deploy command.

## Non-negotiables preserved

- No contact data, no claim *action* (the stub is inert text), no auth.
- Provenance line stays on every profile; new sections link back to sources.
- No new entities created — we only read existing join rows.

## Testing

- A: extend `apps/api/test/smoke.sh` — `GET /projects/:id/publications` and
  `/grants` return 200 and the DS-I/hero project shows ≥1 grant / publication.
- B: pure helpers (`formatUpdated`, confidence→label) get `node:test` units;
  layout/a11y verified manually at mobile width.
