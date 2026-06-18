export interface AuthorCandidate {
  id: string;
  worksCount: number;
  institutionNames: string[];
}

const norm = (s: string) => s.toLowerCase().trim();
const bareId = (url: string) => url.replace(/\/+$/, "").split("/").pop()!;

/**
 * Choose the OpenAlex author that an in-graph person maps to. Only a candidate
 * whose last-known-institution name matches the person's primary org counts;
 * among those, the highest works_count wins. No org / no match → null (skip),
 * so we never guess an identity. Confidence 0.6 (name+institution, fuzzy).
 */
export function pickBestAuthor(
  candidates: AuthorCandidate[],
  orgName: string | null,
): { openalexAuthorId: string; confidence: number } | null {
  if (!orgName) return null;
  const target = norm(orgName);
  const matches = candidates.filter((c) =>
    c.institutionNames.some((n) => {
      const x = norm(n);
      return x === target || x.includes(target) || target.includes(x);
    }),
  );
  if (!matches.length) return null;
  const best = matches.reduce((a, b) => (b.worksCount > a.worksCount ? b : a));
  return { openalexAuthorId: best.id, confidence: 0.6 };
}

/** Live: search OpenAlex authors by name, corroborate by institution. */
export async function resolveAuthorToOpenAlex(
  name: string,
  orgName: string | null,
): Promise<{ openalexAuthorId: string; confidence: number } | null> {
  const { oaGet } = await import("./http.js");
  const res = await oaGet<{ results: Record<string, unknown>[] }>("authors", { search: name, "per-page": "10" });
  const candidates: AuthorCandidate[] = (res.results ?? []).map((a) => ({
    id: bareId((a as { id: string }).id),
    worksCount: (a as { works_count?: number }).works_count ?? 0,
    institutionNames: (((a as { last_known_institutions?: { display_name?: string }[] }).last_known_institutions) ?? [])
      .map((i) => i.display_name ?? "")
      .filter(Boolean),
  }));
  return pickBestAuthor(candidates, orgName);
}

/** Live: search OpenAlex institutions by name, return ROR on a close match. */
export async function resolveOrgToRor(name: string, _country: string | null): Promise<string | null> {
  const { oaGet } = await import("./http.js");
  const res = await oaGet<{ results: Record<string, unknown>[] }>("institutions", { search: name, "per-page": "5" });
  const target = norm(name);
  for (const i of res.results ?? []) {
    const inst = i as { display_name?: string; ror?: string | null };
    const dn = norm(inst.display_name ?? "");
    if (inst.ror && (dn === target || dn.includes(target) || target.includes(dn))) {
      return bareId(inst.ror);
    }
  }
  return null;
}
