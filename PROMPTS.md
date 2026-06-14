# PROMPTS — Research Directory (Claude Code build)

Run in order. Assumes CLAUDE.md, PRD.md, DATA.md, SCREEN-FLOW.md, INGEST.md are in
the repo. Verify each "done" before moving on. V1 now includes **grants** and
**publications**.

## P0 — Setup
```
Read CLAUDE.md and PRD.md. Set up a monorepo (or two folders): a Vite + React +
TypeScript frontend (React Router, Tailwind, shadcn/ui) and an Express + TypeScript
backend exposing a REST API. Add a shared /packages/types module mirroring every enum
in DATA.md, imported by both. The backend connects to Postgres (Supabase) server-side;
the frontend only calls the Express API. NO auth — this product has no login in V1.
```
**Done:** frontend + backend run; shared types compile; DB reachable from Express; no auth.

## P1 — Schema (incl. grants + publications)
```
Using DATA.md as source of truth, write one Supabase migration creating all enums;
entity tables programs, projects, organizations, people, capabilities, GRANTS,
PUBLICATIONS; and edge tables project_members, project_partners, program_membership,
person_affiliation, project_grants, publication_authors (with author_position +
match_confidence), project_publications — each with provenance columns. Add the indexes
in DATA.md (GIN on arrays; full-text on names/titles/abstracts; UNIQUE on publications.doi
and openalex_id where not null; btree on FKs, orcid, openalex_author_id, ror_id). Add
people.merged_into. Migration is plain Postgres DDL (run via your migration tool or
Supabase). Data is served read-only through the Express API in V1; Postgres RLS optional
as defense-in-depth.
```
**Done:** migration applies; every table + index exists.

## P2 — Entity + author resolver
```
Implement resolvers per DATA.md/INGEST.md: resolvePerson({orcid, openalex_author_id,
name, org, country}), resolveOrg({ror_id, name, country}), resolvePublication({doi,
openalex_id, title, year}). For authorship, a matchAuthorToPerson() returning a person id
+ match_confidence (orcid → openalex_author_id → fuzzy name+affiliation). All run BEFORE
edges are written.
```
**Done:** same person/org/publication from two sources resolves to one id; author matcher returns confidences.

## P3 — Ingestion framework + first structural source
```
Per INGEST.md, build the adapter framework under /ingest (one module per source emitting
normalised records) and an idempotent loader: normalise → resolve → upsert(+provenance).
Implement the first STRUCTURAL source as manual/CSV import of my ACE data (organizations
type 'ace', people, capabilities, program_membership to 'World Bank ACE').
```
**Done:** ACE data imported, resolved, provenance-stamped; re-run doesn't duplicate.

## P4 — Read path / profiles (incl. funding + publications sections)
```
Build the public read UI per SCREEN-FLOW.md: Home/Search with facets; grouped search
results (person cards show an "in N consortia" chip); and profiles for Programme,
Project/Consortium (with Funding + Publications sections), Organisation (with Publications),
plus light Publication, Grant, and Capability detail pages. Wire BIDIRECTIONAL navigation
(every name links). Persistent "Sourced from [X] · unverified" label + link-back on every
record. No contact UI anywhere.
```
**Done:** browse ACE data end-to-end with working cross-links; funding/publication sections render (empty until enrichment).

## P5 — The hero: cross-consortium person view (+ outputs)
```
On the Person profile build the footprint section (aggregate project_members across ALL
programmes, grouped by programme/funder with role), plus an Outputs section (their
publications, newest first, low-confidence authorship marked "possible") and a summary
line "Active across N programmes, M institutions · P publications."
```
**Done:** a multi-consortium person renders full footprint + outputs cleanly.

## P6 — More structural sources
```
Add adapters for DS-I Africa (scrape project pages → projects, PIs, partners, institutions)
and DELTAS Africa (programme → consortia → lead orgs, directors, partners), per INGEST.md.
Ingest both; confirm entity resolution links people/orgs appearing in more than one source.
```
**Done:** a real person/org resolves across sources; the cross-consortium view appears on real data.

## P7 — Enrichment: publications + grants (OpenAlex/Crossref/ORCID)
```
Per INGEST.md section B, build the enrichment ingester. SCOPED to entities already in the
graph: for each person (ORCID/OpenAlex author id) and org (ROR), pull works from OpenAlex
(+ Crossref for gaps) → upsert publications + publication_authors (with match_confidence) +
project_publications where a work maps to a known project; read grant/funder data into
grants + project_grants. Do NOT mirror OpenAlex — enrich existing entities only. Idempotent.
```
**Done:** people/projects show real publications; some grants populated; author matches carry confidences; no runaway ingestion.

## P8 — Polish + ship
```
Responsive + accessibility pass. "Last updated" from ingested_at on profiles. Quiet
"Is this you? (coming soon)" stub on person profiles → V2 claim. Deploy to Vercel. Verify
the whole thing — including the hero view with real publications — reads well on a phone
for sharing on LinkedIn/X.
```
**Done:** public URL, mobile-clean, hero view shines, every record provenance-labelled.

---

### Guardrails for every prompt
- No auth, no contact, no claim, no collaboration workflow in V1.
- Provenance + source link on every record, always.
- Entity + author resolution runs before any edge is written.
- Enrichment is scoped to existing graph entities — never mirror OpenAlex.
- Public professional/scholarly data only; no contact data ever.
