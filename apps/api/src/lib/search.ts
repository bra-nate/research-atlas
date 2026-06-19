/**
 * Search helpers ported from the legacy directory queries: prefix tsquery for
 * live as-you-type matching, and a distinct-sorted facet helper.
 */
export function prefixTsQuery(q: string): string | null {
  const tokens = q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter(Boolean);
  return tokens.length ? tokens.map((t) => `${t}:*`).join(" & ") : null;
}

export function uniqSorted(values: (string | null | undefined)[]): string[] {
  return Array.from(
    new Set(values.filter((v): v is string => Boolean(v && v.trim()))),
  ).sort((a, b) => a.localeCompare(b));
}

/** Read a query-string param as a single trimmed string, or undefined. */
export function str(v: unknown): string | undefined {
  if (Array.isArray(v)) v = v[0];
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

/** Parse a capped positive integer limit from a query param. Returns undefined if absent/invalid. */
export function parseLimit(v: unknown, max = 50): number | undefined {
  const n = Number(typeof v === "string" ? v : "");
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(Math.floor(n), max);
}
