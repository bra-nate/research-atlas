# UI PLAN — ACE Connect Africa

> Developer-handoff UI spec. Pairs with `SCREEN-FLOW.md` (screens + flows) and
> `DATA.md` (schema). This file owns the **visual + section layout**; it does not
> repeat the data model. Build order matches `PHASE.md`.

---

## 0. For Claude Code — read first

**Stack:** Vite + React + TypeScript (SPA) · React Router · Tailwind · **shadcn/ui** + Radix ·
**Tremor** for analytics charts · **Motion** (framer-motion) for staggered reveals (optional, graceful-degrade).
Data comes from an **Express + TypeScript** API (the frontend never touches the DB directly).

**Aesthetic direction — "refined institutional."** This is a trust product used by
university leaders and pitched to the World Bank, but operated daily by busy admins.
So: calm, confident, data-legible, generous whitespace, one brand colour used
sparingly. The energy of Linear/Mercury, not a colourful consumer app and not a
dense enterprise console. Precision over decoration. No purple gradients, no Inter,
no stock-SaaS look.

**Two rules that never bend** (from the product spec): the **"Illustrative —
unverified"** badge appears on every seeded record (see §1.10), and the **outcome
capture** step is always present (see Page 7).

---

## 1. Global design system

### 1.1 Typography

Distinctive but institutional. Serif headings give research-sector gravitas;
a civic-feeling sans carries the UI; mono for IDs and data.

| Role | Font | Notes |
|------|------|-------|
| Display / headings | **Newsreader** (serif, 500/600) | Page titles, section titles, profile names |
| Body / UI | **Public Sans** (400/500/600) | All interface text; humanist, civic, not Inter |
| Mono | **IBM Plex Mono** (400/500) | IDs, codes, badges, stat figures, "last verified" |

**Type scale (px / line-height):** display 32/40 · h1 24/32 · h2 20/28 · h3 16/24 ·
body 14/22 (UI base) · small 13/20 · caption 12/16 · mono-data 13/18. Headings use
Newsreader; everything else Public Sans unless noted.

### 1.2 Colour tokens

Jade brand thread carried from the concept note, but used as an accent over a
near-white canvas — not flooded. Map these to shadcn CSS variables.

| Token | Hex | shadcn var | Usage |
|-------|-----|-----------|-------|
| `bg` | `#FBFCFB` | `--background` | Page background (not pure white) |
| `surface` | `#FFFFFF` | `--card` | Cards, panels, rows |
| `surface-muted` | `#F5F8F6` | `--muted` | Table alternates, subtle fills, filter rail |
| `ink-900` | `#0F1A14` | `--foreground` | Primary text |
| `ink-500` | `#5B655E` | `--muted-foreground` | Secondary text, labels |
| `line` | `#E6ECE8` | `--border` | Hairlines, dividers, input borders |
| `brand-700` | `#145A32` | `--primary` | Primary buttons, key actions, active states |
| `brand-500` | `#1F8A4F` | `--ring` | Focus rings, hovers |
| `accent` | `#1ABC9C` | `--accent` | Sparing highlights, active tab indicator |
| `destructive` | `#DC2626` | `--destructive` | Decline, delete, error |

**Status palette** (request lifecycle + verification — used by `StatusPill` and `VerificationBadge`):

| Meaning | Text/dot | Fill |
|---------|----------|------|
| sent | `#64748B` slate | `#F1F5F9` |
| acknowledged | `#2563EB` blue | `#EFF6FF` |
| connected | `#16A34A` green | `#F0FDF4` |
| declined | `#DC2626` red | `#FEF2F2` |
| closed | `#94A3B8` grey | `#F8FAFC` |
| verified | `#145A32` jade | `#ECFDF3` |
| seeded / unverified | `#B45309` amber | `#FFFAEB` |

### 1.3 Spacing, radius, elevation

- **Spacing:** 4px base (Tailwind scale). Section gaps `24px`, card padding `20–24px`, dense table cells `8px × 12px`.
- **Radius:** cards `10px`, inputs/buttons `8px`, pills `9999px`, avatars full.
- **Elevation:** cards rest flat with a `1px line` border (not shadow). Shadows only on floating layers — popovers/menus `0 4px 16px rgba(15,26,20,.08)`; drawers/dialogs `0 12px 40px rgba(15,26,20,.16)`.
- **Container:** content pages max-width `1200px`, centred, `24px` gutters. Dashboards full-bleed within the shell.

### 1.4 Motion

Purposeful and quiet. Durations: fast `120ms`, base `180ms`, slow `240ms`.
Easing: enter `cubic-bezier(.2,.8,.2,1)`, exit `cubic-bezier(.4,0,1,1)`.
One orchestrated moment per page: a `40ms` staggered fade-up on the primary list
or card grid at load. Status changes cross-fade the pill colour. Drawers/dialogs use
Radix transitions. **Always honour `prefers-reduced-motion`** — disable stagger and
slides, keep instant opacity.

### 1.5 App shell

- **Top bar** (`64px`, sticky, `surface`, bottom `1px line`): wordmark left → global
  `Command`-style search (centre, app pages only) → notifications bell + avatar menu right.
- **Left rail** (admin/operator contexts only, `240px`): section nav (Directory, My
  Centre, Requests, Operator). Member/search context uses top nav only — no rail.
- **Role-aware nav:** Member sees Directory + Requests. ACE Admin adds My Centre.
  Operator adds Operator console.
- **Responsive:** rail collapses to icons `<1024px`, becomes a `Sheet` `<768px`; top-bar
  search collapses to an icon that opens a full-screen `Command` palette on mobile.

### 1.6 Component inventory

shadcn/Radix: Button, Input, Textarea, Select, Combobox, Command, Checkbox, Switch,
Badge, Card, Tabs, Dialog, Sheet, DropdownMenu, Tooltip, Avatar, Table, Pagination,
Skeleton, Separator, ScrollArea, Sonner (toasts).

Custom (build once, reuse): `StatusPill` · `VerificationBadge` · `AvailabilityChips`
(the basis-of-availability tags) · `FacetRail` (filter sidebar) · `CentreCard` ·
`ExpertCard` · `RequestRow` · `OutcomeDialog` · `MatchCard` (consortium/examiner result
with a "why" line) · `StatCard` (Tremor) · `EmptyState` · `IllustrativeBadge`.

### 1.7 Global states

- **Loading:** skeletons that match final layout (card skeletons, row skeletons, stat
  skeletons) — never a full-page spinner. Show partial data progressively.
- **Empty:** `EmptyState` = icon + one-line explanation + primary action. Never a blank panel.
- **Error:** inline card with retry; form errors are red text + `destructive` border below the field.
- **Toasts:** Sonner, bottom-right, for request sent / outcome logged / profile saved.

### 1.8 Accessibility baseline

Radix gives focus management and ARIA for dialogs/menus/tabs. Beyond that: logical
focus order top→bottom, visible focus ring (`brand-500`, `2px`), all status conveyed
by **text + colour** (never colour alone — the pills carry a label), `4.5:1` contrast
minimum, full keyboard paths for search → result → request, touch targets `≥44px`.

### 1.9 The `IllustrativeBadge` (global)

A small amber mono badge reading **"Illustrative · unverified"** rendered on every
record whose `verification_status = seeded_unverified` — on cards, profile headers,
and search results. Tooltip: "Seeded sample data, not an official record." Verified
records show the jade `VerificationBadge` instead. This is non-negotiable.

---

## 2. Pages — section by section

Ordered by build priority (Directory + Centre profile first; they set the visual
language everything else inherits). Each page references its functional analog and
the UI to study, per our mapping.

---

### Page 1 — Directory / Search (home)
*Reference: Crunchbase search + LinkedIn Recruiter*

**Overview.** The logged-in home. A verified member searches across centres, experts,
equipment, and services and moves to a profile or fires a request. This is the most-used
screen; speed and scannability win over decoration.

**Layout.** Three zones under the app shell: a left `FacetRail` (`280px`), a main results
column (fluid), and a slim context header above results. On `<1024px` the rail becomes a
"Filters" button opening a `Sheet`.

**Sections.**
1. **Search header** — a large `Command`-style search input with an entity-type segmented
   control (All · Centres · Experts · Equipment · Services). Below it: active-filter chips
   (removable) + result count + sort dropdown (Relevance / Recently verified).
2. **Facet rail** — collapsible groups: Country, Thematic area, Skill (typeahead),
   Availability basis (checkboxes mirroring the seven bases), Equipment category. "Clear
   all" at top. Each group shows top 6 with "show more".
3. **Results list** — `CentreCard` / `ExpertCard` depending on entity type. Card = avatar/logo,
   name + `VerificationBadge`/`IllustrativeBadge`, one-line descriptor, 2–3 meta chips
   (country, theme, top skills), and a right-aligned primary action ("View" / "Request
   connection"). Mixed-entity results group under small section headers.
4. **Pagination** — load-more or paged (24/page).

**Components.** Command, segmented control (Tabs styled as segments), FacetRail, CentreCard,
ExpertCard, Badge, Pagination, Skeleton, EmptyState.

**States & interactions.** Typing debounces 250ms; facet change updates results without full
reload (staggered fade-up). Card hover raises border to `brand-500`, action button reveals.
Empty = "No centres match these filters" + "Clear filters" action.

**Responsive.** Rail → Sheet `<1024px`; cards stack single-column `<768px`; search input full-width.

**Edge cases.** Long centre names truncate to 2 lines; skill chips overflow to "+N"; slow query
shows row skeletons; a result with no logo uses a monogram avatar.

---

### Page 2 — Centre profile
*Reference: Crunchbase company profile + Hivebrite org profile*

**Overview.** The full picture of one ACE and the entry point for most connection requests.

**Layout.** Full-width header band, then a two-column body: sticky left summary (`320px`) +
tabbed right content.

**Sections.**
1. **Header** — logo, centre name (Newsreader display), short name, host university + country,
   `VerificationBadge`/`IllustrativeBadge`, and a `last_verified` mono line. Primary button
   **Request connection** (top-right, sticky on scroll). ACE phase as a small tag.
2. **Left summary (sticky)** — thematic areas as chips, website link, quick counts (experts /
   equipment / services), and a compact "Request connection" repeat for long pages.
3. **Tabs** — People · Equipment · Services · Projects.
   - *People:* grid of compact `ExpertCard`s (name, title, top skills, `AvailabilityChips`,
     availability dot). Click → Expert detail.
   - *Equipment:* list rows (name, category, availability note, access-basis chips). No booking UI.
   - *Services:* simple list (name, category, offered-to).
   - *Projects:* cards with title, themes, and a "looking for" line.
4. **Description** — prose block above or within the People tab.

**Components.** Tabs, ExpertCard, Card, Badge, AvailabilityChips, Button, Tooltip.

**States & interactions.** Tab switch is instant (client). Sticky header condenses to name +
action on scroll. People tab empty = "This centre hasn't listed people yet."

**Responsive.** Left summary collapses above tabs `<1024px`; tabs become a scrollable strip `<768px`.

**Edge cases.** Stale profile (`last_verified` > 6 months) shows a subtle "Verification due" hint
to its own admin only. Missing logo → monogram.

---

### Page 3 — Expert detail
*Reference: LinkedIn profile + GLG/AlphaSights expert profile*

**Overview.** One person's capabilities and how they're available. Drives examiner/expert requests.

**Layout.** Centred single column, `760px` max, with a right meta sidebar on desktop.

**Sections.**
1. **Identity header** — avatar, name (display serif), title, parent centre (linked),
   credential badge (self-declared vs verified), availability status dot.
2. **Availability** — `AvailabilityChips` for each basis (collaboration, co-supervision,
   external examination, advisory, mentorship, secondment, paid consulting). The examiner basis
   is visually distinct since it powers a hero flow.
3. **Skills & specialisations** — chip clouds, grouped.
4. **Bio** — prose.
5. **Action** — sticky **Request connection** (pre-fills request type from context, e.g. "examiner").

**Components.** Avatar, Badge, AvailabilityChips, Button, Separator.

**States & interactions.** "Unavailable" status greys the primary action with a tooltip. If the
expert is `self_managed`, show a quiet "This expert maintains their own listing" note.

**Responsive.** Meta sidebar folds under header `<1024px`.

**Edge cases.** No bio → hide the section, don't show an empty heading. Long skill lists wrap, no truncation.

---

### Page 4 — Request composer
*Reference: LinkedIn InMail + expert-network "request a consultation"*

**Overview.** A focused dialog (not a full page) to send a connection request to a centre,
optionally about a specific person or facility.

**Layout.** `Dialog` (centred, `560px`) — or `Sheet` from the right on mobile.

**Sections.**
1. **Context line** — "To: [Centre name]" + optional referenced expert/equipment as a removable chip.
2. **Request type** — Select (expert / equipment / collaboration / examiner / consortium / general); pre-filled from where the user came.
3. **Subject** — single line.
4. **Message** — textarea, 1500-char soft limit with counter.
5. **Footer** — Cancel + **Send request** (primary).

**Components.** Dialog/Sheet, Select, Input, Textarea, Button, Badge (context chip).

**States & interactions.** Send → button shows spinner, disables; on success the dialog closes and
a toast confirms + offers "View in Outbox". Validation: subject + message required, inline errors.

**Responsive.** Becomes a bottom `Sheet` `<768px`.

**Edge cases.** Over char limit disables Send with a counter in `destructive`. Network failure keeps
the draft and shows retry.

---

### Page 5 — Request inbox + lifecycle
*Reference: Pipedrive/HubSpot pipeline + Linear inbox*

**Overview.** Where admins and members track requests. Two views of the same data: a list inbox
and an optional pipeline board.

**Layout.** Tabs: **Incoming** · **Outgoing**. A view toggle (List / Board). List is default.

**Sections.**
1. **Toolbar** — Incoming/Outgoing tabs, List/Board toggle, status filter, search.
2. **List view** — `RequestRow`s: counterpart centre, subject, type tag, `StatusPill`, age. Click
   opens a right `Sheet` detail drawer.
3. **Detail drawer** — full message, counterpart info, the lifecycle actions, and (once connected)
   the outcome prompt. Lifecycle actions are stage-aware: *Acknowledge* (sent→ack), *Mark connected*
   (ack→connected), *Decline*, *Close*.
4. **Board view (optional)** — Kanban columns = statuses (Sent · Acknowledged · Connected · Closed);
   cards drag between adjacent stages. This is the screen that makes the demo feel like a product.

**Components.** Tabs, Toggle, RequestRow, StatusPill, Sheet, Button, Kanban (custom or dnd-kit), Badge.

**States & interactions.** Status change cross-fades the pill and fires a toast + notification to the
counterpart. Reaching "Connected" surfaces the outcome prompt inline in the drawer (skippable).

**Responsive.** Board → horizontal scroll `<1024px`; defaults to List `<768px`.

**Edge cases.** Empty Incoming = "No requests yet — your centre appears in the directory and members
can reach you here." Declined/closed rows dim but stay visible with a filter to hide.

---

### Page 6 — Outcome capture
*Reference: Pipedrive "won/lost" modal*

**Overview.** The value-proof. One quick, skippable step recording what a connection produced.

**Layout.** Compact `Dialog` (`480px`), or inline panel inside the request drawer.

**Sections.**
1. **Prompt line** — "What came of this connection?"
2. **Outcome type** — radio/segmented list (collaboration started · co-supervision · examiner
   appointed · grant submitted · grant awarded · service delivered · no outcome · other).
3. **Optional note** — short textarea.
4. **Optional value** — single line (e.g. grant amount), mono.
5. **Footer** — **Skip for now** (ghost) + **Save outcome** (primary).

**Components.** Dialog, RadioGroup/segmented, Textarea, Input, Button.

**States & interactions.** Never blocks the user — Skip is always available and equal-weight visually
to avoid coercion. Saving updates the operator dashboard live and toasts "Outcome recorded."

**Responsive.** Bottom `Sheet` `<768px`.

**Edge cases.** "No outcome" is a legitimate, easy choice (don't bury it). Re-openable later to update.

---

### Page 7 — Consortium Builder
*Reference: LinkedIn Recruiter projects + Crossbeam matching + Crunchbase saved lists*

**Overview.** The hero. Turn a funding call into a ranked draft consortium and fire requests to all.

**Layout.** Two-step within one page: an input panel that collapses into a summary once results render.

**Sections.**
1. **Brief input** — funding-call description (textarea), required skills (multi-combobox), required
   countries (multi-select). Primary **Build consortium**.
2. **Results** — ranked `MatchCard`s: centre/expert, match indicators (skill overlap, country),
   and a one-line **"why this match"** justification. A small toggle "AI ranking" (on by default,
   silently falls back to rules-based). Each card has a checkbox.
3. **Action bar (sticky bottom)** — "[N] selected" + **Send connection requests to all** + **Save as search**.

**Components.** Textarea, Combobox, MultiSelect, MatchCard, Checkbox, Switch (AI toggle), Button, sticky action bar.

**States & interactions.** "Build" shows card skeletons; results fade up staggered. Selecting cards
updates the count. "Send to all" opens a confirm summarising recipients, then fires N requests and routes
to Outbox. If AI ranking fails, results still appear (rules-based) with no error shown to the user.

**Responsive.** Input panel stacks; cards single-column `<768px`; action bar stays sticky.

**Edge cases.** No matches → "Broaden skills or countries" with the brief still editable. Justification text
truncates to 2 lines with a tooltip for full.

---

### Page 8 — Examiner Finder
*Reference: LinkedIn Recruiter people search + GLG sourcing*

**Overview.** Find qualified, conflict-free external examiners fast.

**Layout.** Same shape as Directory but pre-scoped to people with the external-examination basis.

**Sections.**
1. **Criteria** — field/specialisation, minimum qualification, requesting centre (for conflict
   exclusion). A persistent note: "Excludes your own centre and flagged conflicts."
2. **Results** — `MatchCard`s for experts: name, centre, qualification, fit indicators, a `ConflictFlag`
   if any soft conflict. Action: **Request as examiner** (opens composer with type pre-set).
3. **Saved searches** — quick access to prior examiner searches.

**Components.** Input, Select, MatchCard, ConflictFlag (badge), Button.

**States & interactions.** Excluded conflicts are hidden by default with a toggle to reveal (labelled).
Selecting → composer with `request_type = examiner`.

**Responsive.** Criteria collapse into a Sheet `<1024px`.

**Edge cases.** Thin networks return few results — show "Only N qualified examiners found" honestly rather than padding.

---

### Page 9 — "My Centre" admin
*Reference: Hivebrite admin console + Retool*

**Overview.** Where an ACE admin maintains everything their centre shows to the network.

**Layout.** Left rail context (Profile · People · Equipment · Services · Projects · Requests) + main
editable panel. Internal-tool feel: tables and forms, low ornament.

**Sections.**
1. **Centre header editor** — inline-editable name, university, country, phase, themes, logo upload,
   description; a prominent **"Verify now / Last verified"** control.
2. **Manage tables** — People/Equipment/Services/Projects each as a `Table` with row actions
   (edit/hide/delete), a search box, and an **+ Add** primary button → opens the relevant Editor.
3. **Verification banner** — if profile is stale, a `surface-muted` banner nudges re-verification.
4. **Requests shortcut** — count of pending incoming requests linking to the inbox.

**Components.** Table, Button, Badge, Tabs/rail, Sheet (editors), Tooltip, Skeleton.

**States & interactions.** All writes are scoped to the admin's own centre (UI guards mirror RLS).
Saving updates `last_verified_at` and the staleness state. Hide vs delete is explicit.

**Responsive.** Rail → top tabs `<1024px`; tables become stacked cards `<768px`.

**Edge cases.** First-run empty centre shows a guided checklist ("Add your first expert"). Upload errors inline.

---

### Page 10 — Editors (centre / expert / equipment / service)
*Reference: Airtable / Notion record editor*

**Overview.** Focused forms for creating/editing one record. Shared shell, different fields.

**Layout.** Right `Sheet` (`480px`) over the admin panel; mobile = full-screen.

**Sections (Expert editor shown; others analogous).**
1. **Identity** — name, title, highest qualification, photo upload.
2. **Capability** — specialisations + skills (tag inputs), bio.
3. **Availability** — basis multi-select (the seven), availability status, credential status, visible/hidden, self-managed toggle.
4. **Footer** — Cancel + **Save** (primary), with **Delete** (destructive, ghost) when editing.

**Components.** Sheet, Input, Textarea, TagInput (Combobox-multi), Select, Switch, Button, photo dropzone.

**States & interactions.** Tag inputs autocomplete from existing skills to keep the taxonomy tidy.
Required fields validated inline. Save toasts and refreshes the parent table.

**Responsive.** Full-screen Sheet `<768px`; sticky footer.

**Edge cases.** Unsaved-changes guard on close. Duplicate skill tags de-duped silently.

---

### Page 11 — Operator → Network Analytics
*Reference: Stripe dashboard (built with Tremor)*

**Overview.** The funder-facing "what did the network produce" view. The screen you open last in the demo.

**Layout.** Full-width dashboard: a top row of `StatCard`s, then a 2-column grid of charts and tables.

**Sections.**
1. **Headline stats** — `StatCard`s: Centres · Experts · Requests (total) · Outcomes logged · Total reported value (mono).
2. **Requests by status** — Tremol bar/donut over the lifecycle statuses.
3. **Outcomes by type** — bar chart (collaboration / examiner / grant submitted / awarded / service / none).
4. **Recent outcomes** — table: counterpart centres, outcome type, value note, date.
5. **Operator tools** — secondary section: verify pending centres, manage invites, seed.

**Components.** Tremor StatCard/BarChart/DonutChart, Table, Badge, Button.

**States & interactions.** Numbers animate up on load (respect reduced-motion). Logging an outcome
elsewhere reflects here on next load. Drill from a stat to its filtered table.

**Responsive.** Stat row wraps 2-up then 1-up; charts stack `<768px`.

**Edge cases.** Early pilot = small numbers; present them plainly, no fake precision. Zero state = "No outcomes recorded yet."

---

### Page 12 — Landing page (public)
*Reference: Hivebrite/Graduway network sites · UI: Mercury + Linear*

**Overview.** The marketing page for AAU/Bank and prospective centres. Institutional, calm, confident.

**Sections.**
1. **Hero** — Newsreader headline ("The connective tissue of Africa's Centres of Excellence"), one-line
   subhead, two CTAs (Request access · See how it works). Restrained jade accent; generous whitespace.
2. **Problem → solution** — three short blocks (isolated centres → visible network; weeks of networking → minutes; donor-dependent → coordinated).
3. **How it works** — three steps with simple diagrams (Profile · Discover · Connect).
4. **Capabilities** — Directory, Consortium Builder, Examiner Finder, Outcome tracking — short cards.
5. **Who it's for** — centres, networks, partners.
6. **Trust strip** — convener logos placeholder (AAU/ACE) + the honest "donor-seeded, phased" note.
7. **Footer** — minimal.

**Components.** Section blocks, Card, Button, simple SVG step diagrams.

**States & interactions.** One orchestrated load: hero text + CTA fade-up staggered. Subtle scroll reveals on sections.

**Responsive.** Single-column stack `<768px`; hero type scales down one step.

**Edge cases.** No live data on landing — all illustrative; keep claims modest and phase-honest.

---

### Page 13 — Sign-in (invite-gated)
*UI: Linear / Vercel auth*

**Overview.** Minimal, fast. Access is invite/approval-gated — no public sign-up form.

**Sections.**
1. **Centred card** — wordmark, "Sign in" heading, email + magic-link or SSO button.
2. **Note** — "Access is by invitation. Request access" link (routes to a contact form, not self-registration).

**Components.** Card, Input, Button.

**States & interactions.** Submit → "Check your email" confirmation state. Errors inline.

**Responsive.** Card full-width with padding `<480px`.

**Edge cases.** Unrecognised email → neutral "If you have access, a link is on its way" (no account enumeration).

---

## 3. Build sequence for the cleanup

1. Global system: tokens, fonts, shadcn theme, app shell, the custom components in §1.6.
2. **Directory/Search** + **Centre profile** (they define the language).
3. Expert detail → Request composer → Inbox/lifecycle → Outcome capture (the spine).
4. Consortium Builder → Examiner Finder (the heroes).
5. My Centre + Editors (admin write path).
6. Operator analytics.
7. Landing + Sign-in.

Ship §1 and the two priority pages first, screenshot them, and confirm the look before
building the rest — everything downstream inherits those decisions.
