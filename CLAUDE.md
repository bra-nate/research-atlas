# CLAUDE.md — Research Directory (working name: rename freely)

> Always-loaded context for Claude Code. Read first. Companion files: PRD, DATA,
> SCREEN-FLOW, INGEST, PROMPTS. Cross-product strategy lives in ../ARCHITECTURE.md.

## What this is

A **public, read-only directory of the African research ecosystem** — programmes,
consortia/projects, organisations, the people in them, their capabilities, their
**funding (grants)**, and their **outputs (publications)** — aggregated from publicly
available sources. Think "Crunchbase for African research consortia": rich entity
profiles wired together with bidirectional links.

This is a **separate product** from ACE Connect. It shares the same data *model* and
codebase, but its own database, brand, and deployment. ACE Connect is private and
sold to the World Bank; this is public and free to browse. They never share a database.

## Scope — V1 (this build)

- Ingest public data → normalise → entity-resolve → browse.
- Search across programmes, projects, organisations, people, capabilities, grants, publications.
- Crunchbase-style profiles with **bidirectional navigation** (project → its people;
  person → all their projects and consortia, across every funder).
- Provenance on every record (source + link-back + "unverified" label).
- **No accounts. No login. No contact. No claim.** V1 is pure discovery.

## Out of scope in V1 (explicitly)

- ❌ Contacting or messaging anyone (no contact data shown, ever)
- ❌ User accounts / auth
- ❌ "Claim your profile" → **V2**
- ❌ Any collaboration/request/meeting workflow (that's ACE Connect's job)
- ❌ Payments or analytics tiers → later

If a prompt drifts toward any of these, stop — wrong product or wrong version.

## The hero feature

Cross-consortium people aggregation. The canonical test: Prof. Gordon Awandare
resolves to **one** person whose profile shows WACCBIP (ACE) + SickleGenAfrica
(H3Africa) + a DELTAS programme together. No source portal shows that span. This is
the reason the product exists — make it sing. It depends on entity resolution
(ORCID/ROR); see DATA.md.

## Stack

- **Frontend:** Vite + React + TypeScript (SPA), React Router, Tailwind + shadcn/ui + Radix
- **Backend:** Express + TypeScript REST API — all data access goes through here
- **Database:** Postgres (Supabase as the Postgres host), accessed server-side from Express (pg/Drizzle or supabase-js service client). **No Auth in V1.**
- **Ingestion:** Node/TS scripts in the backend repo (one adapter per source) — see INGEST.md
- **Shared types:** a `/packages/types` module mirroring DATA.md enums, imported by both frontend and backend
- **Hosting:** static frontend (Vercel/Netlify) + Express service (Render/Railway/Fly); Supabase hosts Postgres
- The browser only calls the Express API (e.g. via React Query) — never the DB directly
- Reuse the design tokens/components from the ACE UI-PLAN (same look family)

## Two non-negotiables

1. **Discovery is public; contact is private.** Never expose contact details or a
   "reach out" action. Index the work, link back to the source, full stop.
2. **Provenance always.** Every record stores its source + source_url and renders a
   visible "Sourced from [X] · unverified" label until (in V2) it is claimed.

## Conventions

- TypeScript throughout; enums mirrored as TS unions in `/lib/types.ts`.
- Server components by default; Postgres full-text + array-overlap for search.
- Every ingested row carries provenance columns (see DATA.md).
- Entity resolution is a first-class concern, not an afterthought.
EOF
