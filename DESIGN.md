# DESIGN — Research Directory (Crunchbase-style)

> The directory's visual direction. Pairs with `SCREEN-FLOW.md` (structure). This
> product uses **this** look — Crunchbase-style — NOT the ACE product's jade
> "refined institutional" tokens. They are separate products with separate brands.

## Direction

Crunchbase's aesthetic in one line: **clean, white, information-dense, utilitarian.**
Pure-white surfaces, a single vivid blue for links and actions, everything cross-linked,
data presented in tight cards and sortable tables, all sans-serif, almost no decoration.
The design gets out of the way so the *data graph* is the star. Match that.

> Note: the hex/font values below are faithful approximations of Crunchbase's palette.
> For an exact match, colour-pick the live values from crunchbase.com. And match the
> *language*, not the trademark — use your own logo/wordmark and your own primary blue
> (staying in the same family is fine); don't replicate their exact brandmark.

## 1. Colour tokens

| Token | Hex (approx) | Usage |
|-------|------|-------|
| `bg` | `#FFFFFF` | Page background — pure white, not off-white |
| `surface-alt` | `#F5F7FA` | Filter rail, table headers, subtle panels |
| `ink` | `#16181D` | Primary text (cool near-black) |
| `ink-secondary` | `#667085` | Secondary text, labels, meta |
| `border` | `#E4E7EC` | Hairlines, card borders, dividers, input borders |
| `primary` | `#0A66FF` | Links, primary buttons, active states *(verify exact)* |
| `primary-hover` | `#0A4FCC` | Hover/pressed |
| `tag-bg` | `#EFF1F4` | Pill/tag background (grey) |
| `tag-ink` | `#344054` | Pill/tag text |
| `positive` | `#067647` | Optional positive accents |

Links and interactive blue are the only strong colour — everything else is white, grey,
and near-black. Resist adding a second accent.

## 2. Typography

All sans-serif (Crunchbase has **no** serif — this is a key difference from the ACE look).
Crunchbase uses a custom grotesque; closest free matches: **Hanken Grotesk** or **Geist**
(use Inter only if you want the most literal match). Tabular figures for data/counts.

Scale (px / line-height) — dense:
- Profile name / page title: 26/32, semibold
- Section header: 17/24, semibold
- Card title: 15/22, medium
- Body / UI base: 14/22
- Meta / labels: 13/18
- Small / table dense: 12/16
- Data figures: tabular-nums

## 3. Density, radius, elevation

- **Density:** tighter than a typical app. Table rows ~40–44px, card padding 16px, section gaps 20px. Information-rich, not airy.
- **Radius:** cards/inputs/buttons `8px`; tags/pills full; avatars/logos `6px` (squared, not round — Crunchbase uses rounded squares for org logos).
- **Elevation:** flat. Cards rest on a `1px border`, no shadow; add a faint shadow only on hover (`0 1px 4px rgba(16,24,40,.08)`). Floating menus get a soft shadow.

## 4. Layout shell

- **Top nav** (`56px`, sticky, white, bottom `1px border`): wordmark left → prominent global search (centre/left) → nav links → a single blue CTA right. No login surface in V1.
- **Breadcrumbs** under the nav on profile pages (`Home / Programmes / H3Africa`).
- **Search & list pages:** left **filter rail** (`~280px`, `surface-alt` or white with grouped checkboxes) + main results column.
- **Container:** comfortable max-width (~1200px) but content runs dense within it.

## 5. Core patterns

**Search + results.** Big search input; left filter rail (country, programme/funder,
theme, org type, skill); main column as either dense **result rows** or compact **cards**.
Each result: small squared logo/monogram, name (blue link), one-line descriptor, a row of
grey meta tags, and a right-aligned count or action. Result count + sort sit above the list.

**Entity profile pages** (the heart — Crunchbase's signature):
- **Header band:** squared logo/avatar, name (26px semibold), a one-line descriptor, and a
  horizontal **key-facts row** (e.g. country · type · programme · ROR) rendered as
  label/value pairs. A small action/link cluster on the right.
- **Two columns:** a left **summary rail** (key attributes, external links, quick counts)
  + a main column of stacked **section cards**.
- **Section cards:** titled white cards with a hairline border ("People", "Publications",
  "Funding", "Projects"), each showing a few rows + a "See all (N)" link. This card-stack
  *is* the Crunchbase profile pattern.
- **Everything is a blue link** — every org, person, project, funder is clickable, which
  drives the bidirectional graph navigation.

**Tables.** For long lists (publications, people): dense, sortable columns, `surface-alt`
header row, hairline row dividers, blue-linked primary cell, tabular figures.

**Tags/pills.** Grey `tag-bg` pills with `tag-ink` text for themes/skills/roles. Keep flat.

## 6. Components
Buttons: solid blue primary, white/bordered secondary, `8px` radius, medium weight.
Links: `primary`, underline on hover. Badges/pills: grey, full radius. Tabs: underline-style
active indicator in blue. Cards: white, `1px border`, `8px` radius. Avatars/logos: squared
`6px`. Inputs: white, `1px border`, blue focus ring.

## 7. Motion
Minimal and snappy — Crunchbase is utilitarian. Fast hovers (~120ms), instant tab switches,
skeletons on load. No decorative animation. Honour `prefers-reduced-motion`.

## 8. Mapping to the directory screens
- **Home / Search:** top search + left filter rail + dense result rows (person rows show an "in N consortia" chip).
- **Programme / Project / Organisation / Person profiles:** the header-band + summary-rail + section-card stack pattern. Person (hero) stacks cards: *Footprint* (projects/consortia by funder), *Outputs* (publications), *Funding involvement* — all blue-linked.
- **Publication / Grant detail:** light single-column profile with the same header + key-facts + linked-entities treatment.
- **Capability detail:** compact card; descriptive only.
- Provenance ("Sourced from [X] · unverified") renders as a small grey meta chip in headers and cards.

## 9. The one caveat
Match Crunchbase's design *language* — the structure, density, and patterns above — not its
trademarked identity. Your own name, logo, and a primary blue you choose. Same feel, your brand.
