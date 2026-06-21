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

## Design Context

> Captured via `/teach-impeccable` (2026-06-20). This is the live design direction
> and **supersedes the strict "plain Crunchbase" framing in `DESIGN.md`** where they
> conflict: keep DESIGN.md's *structure* (dense entity profiles, bidirectional links,
> section-card stacks, provenance), but reject its "utilitarian / almost no decoration /
> resist a second accent" mandate. The current build was judged **too raw** — generic
> blue-and-white with system fonts and no identity. We are deliberately moving beyond that.

### Users
Researchers, funders, programme officers, journalists, and the curious public exploring
the African research ecosystem — programmes, consortia, organisations, people, capabilities,
grants, publications. They arrive to *discover and trace connections* (the hero: one person
across every consortium they appear in). Read-only, no accounts, no contact. Context is
exploratory and reference-grade: they trust this as a source of truth and follow links deeply.

### Brand Personality
Three words: **credible, modern, effortless.** Voice is confident and editorial — an
authoritative reference that feels alive and current, never a dusty government database.
Emotional goals: confidence/trust in the data, a sense of craft and momentum, and calm
legibility so the *data graph* is always the hero. Professional and global in tone — not
culturally themed (African-pride motifs were explicitly not requested).

### Aesthetic Direction
**Bold & expressive, disciplined by clarity.** Synthesis of three references:
- **Crunchbase / data tools** — the structural bones: dense, cross-linked entity profiles,
  sortable tables, compact result rows, key-facts bands, section-card stacks.
- **Editorial / institutional** (Wellcome, OpenAlex, foundation sites) — serious, branded,
  content-rich confidence; strong headlines and a real point of view, especially on the
  landing and directory.
- **Linear / Stripe / Vercel** — premium-minimal craft: refined type scale, intentional
  spacing, subtle depth, crisp focus states, tasteful micro-interactions.

Concretely this means: a real **typographic identity** (a distinctive display/headline face
paired with a clean text face — replace the bare system-font stack), a **palette with more
range than one blue** (a confident primary plus a signature accent and supporting tones; an
`accent` orange already exists in the Tailwind config — use it intentionally or replace it),
**depth and polish** (considered elevation on hover, not flat-everything), an **expressive
landing hero** while keeping interior/profile pages dense and scannable. **Dark mode is in
scope** (not light-only) — design tokens should be theme-ready. Anti-reference: generic
AI-default SaaS, raw blue-on-white with no identity, decoration that competes with the data.

### Design Principles
1. **Data is the hero; chrome is quiet.** Every expressive choice must improve scanning and
   navigation, never compete with the entity graph. Bold on the landing, calm in the tables.
2. **Earn trust through craft.** Credibility comes from typographic rhythm, alignment,
   consistent spacing, and provenance always visible — polish *is* the authority signal.
3. **One confident voice, not a rainbow.** A primary + one signature accent + disciplined
   neutrals. Expressive ≠ loud; range is purposeful, not scattered.
4. **Everything links; make links sing.** Bidirectional navigation is the product — entity
   links, hover affordances, and the "in N consortia" hero teaser should feel inviting.
5. **Theme-ready and accessible.** Build tokens for light + dark, honour
   `prefers-reduced-motion`, maintain AA contrast, and keep dense layouts legible.
EOF
