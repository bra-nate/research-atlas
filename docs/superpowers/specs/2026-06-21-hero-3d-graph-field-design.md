# GraphField — ambient 3D knowledge graph (hero motif)

**Date:** 2026-06-21
**Status:** Approved (design), pending implementation plan
**Area:** `apps/web` landing hero

## Summary

Replace the static SVG `GraphMotif` in the landing hero's right column with
`GraphField` — a self-contained WebGL component (raw three.js) that renders an
ambient, slowly-drifting node-and-edge network in 3D with subtle cursor
parallax. It dramatizes the product's core pitch ("one navigable graph") and the
cross-consortium hero feature, while staying decorative: `aria-hidden`, no
pointer interaction, no navigation.

This supersedes `GraphMotif` (apps/web/src/routes/landing.tsx:191–231) in the
hero only. `GraphMotif` may be kept as the reduced-motion static fallback (see
below) or removed if the static-frame fallback covers it.

## Goals

- A live 3D graph that reads as the current motif "leveled up," not a new mascot.
- On-brand and on-message; never competes with the search box (principle:
  "data is the hero, chrome is quiet").
- Accessible and performant: respect `prefers-reduced-motion`, lazy-load, cap GPU work.

## Non-goals

- No clicking / hover labels / orbit controls (ambient + parallax only).
- Not data-driven in this build — graph is a deterministic generated layout.
  (Data-seeding from `/stats` or featured-people is a documented future option,
  see "Future".)
- No change to the hero layout, copy, search form, or grid.

## Placement

Drops into the existing slot at `apps/web/src/routes/landing.tsx` where
`<GraphMotif />` is rendered (line ~184), inside the hero grid's right column.
Keep the `hidden lg:block` visibility — desktop only; mobile never mounts WebGL.

## Visual

- ~18–24 nodes: one larger central **hub** (emerald) = the person-across-consortia;
  smaller satellites around it.
- Edges: thin `LineSegments` from hub to satellites + a few satellite–satellite
  links, mirroring the current SVG's story.
- Palette from Tailwind tokens (hero sits on `brand-deep` #0A2E29):
  - Hub + edges: emerald `#15A06B`
  - Satellites: white `#FFFFFF` (high opacity)
  - A few accent nodes: violet `#6D28D9` (echoes hero-feature surfaces)
- Soft additive glow on nodes; slow per-node pulse.
- Depth fog so far nodes recede into the band.

## Motion

- Whole-group slow rotation about Y (very low angular velocity).
- Per-node sine bob (small amplitude, phase offset per node).
- Parallax: lerp the group/camera a small amount toward normalized pointer
  offset, listening on the hero section (not window) and easing back to center.
- Honor `prefers-reduced-motion` (see Fallback).

## Architecture

Single file: `apps/web/src/components/graph-field.tsx`.

- A host `<div ref>` sized by container; `useEffect` constructs
  `Scene / PerspectiveCamera / WebGLRenderer` and a `requestAnimationFrame` loop.
- **Graph data:** a deterministic generator (fixed integer seed → small PRNG,
  e.g. mulberry32; NO `Math.random`/`Date.now` so SSR/build is stable) returning
  `{ nodes: {pos, size, color}[], edges: [i,j][] }`. Kept as a plain structure so
  it can later be swapped for real data without touching render code.
- **Nodes:** small sphere meshes or a `Points` cloud with a circular glow
  texture (decide in plan; `Points` is cheaper). Per-node color/size from data.
- **Edges:** one `LineSegments` with a `LineBasicMaterial`, low opacity.
- **Pointer:** listener attached to the hero container; store normalized target,
  lerp each frame.
- **Resize:** `ResizeObserver` on the host updates camera aspect + renderer size.
- **Cleanup:** cancel RAF, remove listeners/observer, dispose geometries,
  materials, textures, and `renderer.dispose()` on unmount.
- `dpr` capped at 2 (`Math.min(window.devicePixelRatio, 2)`).

## Performance

- Lazy-load via `React.lazy` + dynamic `import()` so the three.js chunk never
  blocks first paint; wrap in `<Suspense fallback={<GraphFallback />}>`.
- Pause the RAF loop when the canvas is offscreen (IntersectionObserver) and when
  `document.hidden` (visibilitychange) to save battery/GPU.
- Single draw-heavy objects (one LineSegments, one Points/instanced nodes) — no
  per-node draw calls.
- Antialias on; tone-mapping default; no post-processing.

## Fallback & accessibility

- Whole component is `aria-hidden` (decorative).
- `prefers-reduced-motion: reduce` → do not start the animation loop; render a
  single static frame (or fall back to the existing SVG `GraphMotif`). Decide one
  in the plan; static-three-frame keeps a single visual language.
- No WebGL context (or `import()` failure) → `<GraphFallback />` renders the
  existing SVG so the column is never empty.
- Suspense fallback during chunk load = the SVG (no layout shift).

## Theming

Reads on the dark `brand-deep` band today. Colors come from token hex values
mirrored in the component (three.js needs raw hex, not CSS vars). If a light hero
theme ever ships, expose a `tone?: "dark" | "light"` prop; out of scope now.

## Dependencies

- Add `three` and `@types/three` to `apps/web`. Raw three.js only — no
  react-three-fiber / drei.

## Files touched

- `apps/web/src/components/graph-field.tsx` — new component.
- `apps/web/src/routes/landing.tsx` — swap `<GraphMotif />` for lazy
  `<GraphField />` + Suspense; keep `GraphMotif` as fallback or remove.
- `apps/web/package.json` — add deps.

## Future (not this build)

- Seed nodes/edges from real `/stats` or `/people/featured` so the graph
  reflects actual atlas contents.
- Optional hover/click to navigate (would change it from decorative to
  interactive — reconsider a11y if pursued).

## Testing / verification

- Builds and type-checks; lazy chunk splits out of the main bundle.
- Renders on the landing hero (desktop ≥ lg), animates, parallax responds.
- `prefers-reduced-motion` path renders static, no RAF running.
- Forced WebGL-off path shows the SVG fallback.
- No console errors; clean unmount (no leaked RAF/listeners) when navigating away.
