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
