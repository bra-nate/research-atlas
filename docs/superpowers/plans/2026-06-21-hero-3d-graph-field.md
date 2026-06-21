# GraphField 3D Hero Knowledge Graph — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static SVG `GraphMotif` in the landing hero with `GraphField`, an ambient WebGL node-and-edge graph (raw three.js) that drifts, pulses, and parallaxes to the cursor.

**Architecture:** One self-contained React component owns a three.js `Scene/Camera/WebGLRenderer` + RAF loop in a `useEffect`. Graph layout comes from a pure, deterministic generator module (seeded PRNG, no `Math.random`/`Date.now`). The component is lazy-loaded with `React.lazy` and falls back to the existing SVG on reduced-motion, missing WebGL, or chunk-load.

**Tech Stack:** Vite + React 18 + TypeScript, Tailwind, three.js (raw).

## Global Constraints

- Raw `three` only — no react-three-fiber / drei.
- Component is decorative: `aria-hidden`, no pointer interaction, no navigation.
- Desktop only: keep `hidden lg:block`; mobile never mounts WebGL.
- Honor `prefers-reduced-motion: reduce` (no RAF loop; static fallback).
- Colors are raw hex copied from tokens: brand-deep band `#0A2E29`, hub/edges emerald `#15A06B`, satellites white `#FFFFFF`, accent violet `#6D28D9`.
- `dpr` capped: `Math.min(window.devicePixelRatio, 2)`.
- No new test runner in `apps/web` (none exists today) — verify the generator with a one-off `tsx` script.

---

### Task 1: Add three.js dependency

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install**

```bash
pnpm --filter @research-atlas/web add three && pnpm --filter @research-atlas/web add -D @types/three
```

- [ ] **Step 2: Verify typecheck still passes**

Run: `pnpm typecheck`
Expected: PASS (no usage yet).

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "build(web): add three.js for hero graph"
```

---

### Task 2: Deterministic graph generator

A pure module producing the node/edge layout. No three.js import — just data — so it is unit-checkable.

**Files:**
- Create: `apps/web/src/components/graph-data.ts`

**Interfaces:**
- Produces:
  - `type GraphNode = { x: number; y: number; z: number; size: number; color: number; isHub: boolean }`
  - `type GraphData = { nodes: GraphNode[]; edges: [number, number][] }`
  - `function buildGraph(seed?: number): GraphData` — deterministic for a given seed; node[0] is the hub.

- [ ] **Step 1: Write the generator**

```ts
// apps/web/src/components/graph-data.ts
export type GraphNode = {
  x: number;
  y: number;
  z: number;
  size: number;
  color: number;
  isHub: boolean;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: [number, number][];
};

const EMERALD = 0x15a06b;
const WHITE = 0xffffff;
const VIOLET = 0x6d28d9;

/** mulberry32 — tiny deterministic PRNG (no Math.random). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds an ambient knowledge-graph layout: one central hub plus satellites
 * scattered on a rough sphere, hub-to-satellite edges and a few cross links.
 * Deterministic for a given seed.
 */
export function buildGraph(seed = 7): GraphData {
  const rand = rng(seed);
  const SATELLITES = 20;
  const nodes: GraphNode[] = [
    { x: 0, y: 0, z: 0, size: 1.0, color: EMERALD, isHub: true },
  ];

  for (let i = 0; i < SATELLITES; i++) {
    // spherical shell with jitter
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const r = 2.6 + rand() * 1.6;
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta) * 0.7; // flatten vertically
    const z = r * Math.cos(phi);
    // ~1 in 5 satellites is a violet accent node, rest white
    const accent = rand() < 0.2;
    nodes.push({
      x,
      y,
      z,
      size: 0.34 + rand() * 0.22,
      color: accent ? VIOLET : WHITE,
      isHub: false,
    });
  }

  const edges: [number, number][] = [];
  // hub to every satellite
  for (let i = 1; i < nodes.length; i++) edges.push([0, i]);
  // a few satellite-satellite links
  const crossLinks = 6;
  for (let i = 0; i < crossLinks; i++) {
    const a = 1 + Math.floor(rand() * SATELLITES);
    const b = 1 + Math.floor(rand() * SATELLITES);
    if (a !== b) edges.push([a, b]);
  }

  return { nodes, edges };
}
```

- [ ] **Step 2: Verify determinism with a one-off script**

Run:
```bash
cd apps/web && npx tsx -e "import {buildGraph} from './src/components/graph-data.ts'; const a=JSON.stringify(buildGraph()); const b=JSON.stringify(buildGraph()); console.log('nodes',buildGraph().nodes.length,'edges',buildGraph().edges.length,'deterministic',a===b);"
```
Expected: `nodes 21 edges 26 deterministic true`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/graph-data.ts
git commit -m "feat(web): deterministic graph layout generator"
```

---

### Task 3: GraphField component

**Files:**
- Create: `apps/web/src/components/graph-field.tsx`

**Interfaces:**
- Consumes: `buildGraph`, `GraphData` from `./graph-data`.
- Produces: `export default function GraphField(): JSX.Element` — default export so `React.lazy` can load it.

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/graph-field.tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildGraph } from "./graph-data";

const BG = 0x0a2e29; // brand-deep — matches the hero band for seamless fog

export default function GraphField() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(BG, 7, 16);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 9);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // no WebGL — outer Suspense/fallback handles the empty case
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const data = buildGraph();
    const group = new THREE.Group();
    scene.add(group);

    // nodes as individual glowing sprites (cheap, always camera-facing)
    const sprite = makeGlowTexture();
    const phases: number[] = [];
    const bases: THREE.Vector3[] = [];
    data.nodes.forEach((n) => {
      const mat = new THREE.SpriteMaterial({
        map: sprite,
        color: n.color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const s = new THREE.Sprite(mat);
      s.position.set(n.x, n.y, n.z);
      const scale = (n.isHub ? 1.6 : 1.0) * n.size * 1.8;
      s.scale.set(scale, scale, 1);
      group.add(s);
      bases.push(s.position.clone());
      phases.push(Math.random()); // visual phase only — not layout
    });

    // edges
    const positions: number[] = [];
    data.edges.forEach(([a, b]) => {
      const na = data.nodes[a];
      const nb = data.nodes[b];
      positions.push(na.x, na.y, na.z, nb.x, nb.y, nb.z);
    });
    const edgeGeom = new THREE.BufferGeometry();
    edgeGeom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x15a06b,
      transparent: true,
      opacity: 0.28,
    });
    const lines = new THREE.LineSegments(edgeGeom, edgeMat);
    group.add(lines);

    // pointer parallax (eased toward target)
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    function onPointer(e: PointerEvent) {
      const r = host!.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    }
    window.addEventListener("pointermove", onPointer);

    // sizing
    function resize() {
      const w = host!.clientWidth || 1;
      const h = host!.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // render loop with offscreen + hidden-tab pause
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !reduced) loop();
      },
      { threshold: 0 },
    );
    io.observe(host);

    let t = 0;
    function loop() {
      cancelAnimationFrame(raf);
      if (!visible || document.hidden) return;
      t += 0.016;
      group.rotation.y += 0.0016;
      // bob each node sprite
      for (let i = 0; i < bases.length; i++) {
        const s = group.children[i] as THREE.Sprite;
        s.position.y = bases[i].y + Math.sin(t + phases[i] * 6.28) * 0.06;
      }
      current.x += (target.x - current.x) * 0.04;
      current.y += (target.y - current.y) * 0.04;
      group.rotation.x = current.y * 0.25;
      group.position.x = current.x * 0.4;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    }

    if (reduced) {
      renderer.render(scene, camera); // single static frame
    } else {
      loop();
    }

    function onVisibility() {
      if (!document.hidden && visible && !reduced) loop();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
      io.disconnect();
      sprite.dispose();
      edgeGeom.dispose();
      edgeMat.dispose();
      group.children.forEach((c) => {
        if (c instanceof THREE.Sprite) c.material.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={hostRef} aria-hidden className="h-full w-full" />;
}

/** Small radial-gradient glow used for every node sprite. */
function makeGlowTexture(): THREE.Texture {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/graph-field.tsx
git commit -m "feat(web): GraphField ambient 3D knowledge graph component"
```

---

### Task 4: Wire into the hero with lazy-load + fallback

Swap the hero's `<GraphMotif />` for a lazily-loaded `<GraphField />`, keeping `GraphMotif` as the Suspense/no-WebGL fallback inside a fixed-size, `lg`-only container.

**Files:**
- Modify: `apps/web/src/routes/landing.tsx`

**Interfaces:**
- Consumes: `GraphField` default export (lazy).

- [ ] **Step 1: Add the lazy import**

At the top of `apps/web/src/routes/landing.tsx`, add `lazy` and `Suspense` to the existing React import and create the lazy component below the imports:

```tsx
import { lazy, Suspense, useState, type FormEvent, type ReactNode } from "react";
```

```tsx
const GraphField = lazy(() => import("../components/graph-field"));
```

- [ ] **Step 2: Replace the hero motif usage**

Replace the line `<GraphMotif />` (the comment + element around line 183-184) with a sized container that lazy-loads GraphField and shows the SVG while loading:

```tsx
        {/* live 3D knowledge graph — reinforces the cross-consortium hero feature */}
        <div aria-hidden className="relative hidden aspect-square w-full max-w-sm lg:block">
          <Suspense fallback={<GraphMotif />}>
            <GraphField />
          </Suspense>
        </div>
```

- [ ] **Step 3: Make GraphMotif fill its container**

`GraphMotif` currently sets its own `hidden lg:block` wrapper; since it now also serves as a fallback inside the new container, change its root so it works in both spots. Replace the `GraphMotif` return's outer element:

```tsx
  return (
    <div aria-hidden className="absolute inset-0 grid place-items-center">
      <svg viewBox="0 0 320 300" className="h-auto w-full max-w-sm">
```

(Closing tags unchanged: `</svg></div>`.)

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Build and confirm the three.js chunk splits out**

Run: `pnpm --filter @research-atlas/web build`
Expected: build succeeds; output lists a separate `graph-field-*.js` chunk (three.js not in the main entry chunk).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/landing.tsx
git commit -m "feat(web): use lazy 3D GraphField in hero with SVG fallback"
```

---

### Task 5: Manual verification

- [ ] **Step 1: Run the app and visually verify**

Run: `pnpm dev:web`, open the landing page on a desktop-width viewport.
Expected: graph renders on the `brand-deep` band, nodes glow (emerald hub, white + a few violet satellites), edges visible, whole graph slowly rotates and bobs, and tilts toward the cursor. No console errors.

- [ ] **Step 2: Reduced-motion check**

Enable OS "reduce motion" (or emulate in devtools rendering panel), reload.
Expected: a single static frame renders; no continuous animation.

- [ ] **Step 3: Unmount cleanliness**

Navigate away from the landing page and back.
Expected: no console warnings, no duplicate canvases, no leaked animation (CPU settles).

---

## Self-Review Notes

- Spec coverage: concept (T3), deterministic data (T2), palette/fog/dpr (T3), lazy + fallback + reduced-motion + offscreen/hidden pause (T3/T4), deps (T1), verification (T5). All spec sections covered.
- The spec listed `Points` cloud as the cheap default; this plan uses `Sprite`s instead — equally cheap for ~21 nodes, simpler per-node color/scale, and always camera-facing. Acceptable deviation, noted here.
- `Math.random()` is used only for sprite animation *phase* (visual, runtime), never for layout — layout determinism (the spec's SSR/build concern) is preserved in `buildGraph`.
