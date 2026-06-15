import type { PersonUpsert } from "./types.js";

/** Strip an OpenAlex/ORCID/ROR URL down to its bare id. */
function bareId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.trim().split(/[?#]/)[0].replace(/\/+$/, "").split("/").pop();
  return m || null;
}

interface OAAuthor {
  id: string;
  orcid: string | null;
  display_name: string;
  works_count?: number;
  counts_by_year?: { year: number; works_count: number }[];
  last_known_institutions?: { ror?: string | null }[];
  x_concepts?: { display_name: string; score: number }[];
}

export function normalizeAuthor(a: OAAuthor): PersonUpsert {
  const activeYears = (a.counts_by_year ?? [])
    .filter((c) => c.works_count > 0)
    .map((c) => c.year);
  const themes = (a.x_concepts ?? [])
    .slice()
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map((c) => c.display_name);
  const primaryRor = (a.last_known_institutions ?? [])
    .map((i) => i.ror)
    .find((r) => r != null);
  return {
    fullName: a.display_name,
    orcid: bareId(a.orcid),
    openalexAuthorId: bareId(a.id),
    specializations: themes,
    worksCount: a.works_count ?? null,
    lastActiveYear: activeYears.length ? Math.max(...activeYears) : null,
    primaryOrgRor: bareId(primaryRor ?? null),
    sourceUrl: a.id,
  };
}
