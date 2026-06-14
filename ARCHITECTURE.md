# ARCHITECTURE — Two Products, One Data Model

> Revised. The directory and ACE Connect are **two independent products** that
> share a data model and codebase — not one product with two layers. They have
> separate brands, databases, deployments, and sales motions.

---

## 1. Why two separate products

ACE Connect is what you sell to the World Bank / AAU — that revenue is worth more
than folding ACEs into a free public directory, and a buyer like that wants their
system clean, ownable, and data-isolated. So the products stay apart:

- **Product A — ACE Connect** (private, sold). Managed accounts, admins, connection
  requests, collaboration tracking, meeting scheduling, status reports, regulator
  oversight. Its own deployment + database + brand. *(See the ACE build suite:
  CLAUDE / PRD / PHASE / DATA / SCREEN-FLOW / PROMPTS.)*
- **Product B — Research Directory** (public, free to browse). Ingested from public
  sources, read-only, **no contact**, Crunchbase-style discovery across the African
  research ecosystem. Its own deployment + database + brand. *(See the directory
  build suite.)*

**What's shared:** the data *model* (schema design) and the shared codebase — a
**Vite + React** frontend, an **Express + TypeScript** API, **Postgres**, and shadcn
components — so you build once. **What's not shared:** the database. They never touch
at the data level.

An ACE centre can legitimately appear in both — a private managed account in
Product A, and a public ingested profile in Product B — exactly like a company
having a private CRM *and* a public Crunchbase listing. No confusion, because
they're different products.

---

## 2. Directory: V1 vs V2

**V1 — pure read-only public directory.**
Ingest public data → normalise → entity-resolve → browse. Bidirectional
Crunchbase-style navigation. **No accounts, no contact, no claim.** This is the
whole first build.

**V2 — participation.**
"Claim your profile" (verify, correct, opt out), profile analytics
("who viewed your consortium"), and a possible analytics/API tier (see §4).

Keeping claim in V2 means V1 has no auth at all — faster to ship, lower legal
surface, and you validate the directory on public data alone before building
participation.

---

## 3. The hero feature

**Cross-consortium people aggregation.** The same person threads multiple
programmes — Prof. Gordon Awandare appears under WACCBIP (a World Bank ACE), under
SickleGenAfrica (H3Africa), and under a DELTAS programme. No single consortium
portal shows that span, because each only knows its own slice. Your directory is
the only place his full footprint is visible in one view. Click a project → see all
its people; click a person → see every project and consortium they belong to,
across all funders. If you nail one thing, nail this. It depends entirely on
entity resolution (ORCID for people, ROR for institutions) — see `DATA.md`.

---

## 4. Monetization (the honest version)

Crunchbase's engine — subscriptions + data licensing — monetises sales, recruiting,
and prospecting. **That doesn't map 1:1 to you:** you have no contact data, your
heaviest users (researchers) won't pay, and your dataset is a public good. So the
sales-intelligence subscription engine is weak here. What *does* fit:

- **Ecosystem-intelligence subscriptions (B2B/B2G).** Funders, governments and
  science ministries, the AU / AUDA-NEPAD, and university research offices pay for
  dashboards over the graph — capacity maps, collaboration networks, gaps, trends.
  The Crunchbase-Enterprise analog, but *intelligence* not prospecting.
- **Data licensing / API.** License the structured graph to funders, evaluators,
  and tools. Crunchbase's strongest non-subscription stream, and it fits because
  this data is otherwise fragmented across dozens of portals.
- **Philanthropic / grant underwriting.** The realistic V1 funder. Wellcome, the
  Science for Africa Foundation, NIH, Gates, or the World Bank underwrite it as a
  public good (cf. OpenAlex, Open Research Africa). Early on, grant money beats user
  revenue.
- **Premium institutional features (V2).** Claim-and-manage, verified badges,
  profile analytics, enhanced visibility.

**Honest caveat:** a free directory of public data has weak direct consumer revenue,
and every paid stream above needs comprehensive, *fresh* coverage first. Treat the
directory early as a credibility asset and a second funder door — the thing that
makes you "the person who mapped African research," which also strengthens the ACE
sale — not as a near-term revenue line.

---

## 5. Guardrails (both products inherit; directory especially)

- **Discovery is public; contact is private.** The directory never exposes contact
  details or a "reach out" action. All contact lives in ACE Connect only.
- **Provenance on everything.** Every ingested record links back to its source and
  shows "Sourced from [X] · unverified."
- **Opt-out / correction** available on every person profile (becomes full claim in V2).
- Mind **POPIA (SA), Ghana DPA, Nigeria NDPR** — aggregating named individuals at
  scale carries obligations even when each fact is public.

Schema, screens, ingestion, and build prompts for the directory are in its own suite.
