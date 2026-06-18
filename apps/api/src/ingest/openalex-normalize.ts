import type { GrantUpsert, OrgUpsert, PersonUpsert } from "./types.js";

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

interface OAInstitution {
  id: string;
  ror?: string | null;
  display_name: string;
  country_code?: string | null;
  homepage_url?: string | null;
}

export function normalizeInstitution(i: OAInstitution): OrgUpsert {
  return {
    name: i.display_name,
    shortName: null,
    orgType: "university",
    country: i.country_code ?? null,
    website: i.homepage_url ?? null,
    rorId: bareId(i.ror ?? null),
    sourceUrl: i.id,
  };
}

interface OAWork {
  id: string;
  grants?: { funder: string; funder_display_name: string; award_id: string | null }[];
}

export function normalizeGrants(works: OAWork[]): GrantUpsert[] {
  const byKey = new Map<string, GrantUpsert>();
  for (const w of works) {
    for (const g of w.grants ?? []) {
      const key = `${g.funder_display_name.toLowerCase()}|${g.award_id ?? ""}`;
      if (byKey.has(key)) continue;
      byKey.set(key, {
        name: g.award_id ? `${g.funder_display_name} ${g.award_id}` : g.funder_display_name,
        awardNumber: g.award_id,
        amount: null,
        currency: null,
        startDate: null,
        endDate: null,
        funder: {
          name: g.funder_display_name,
          shortName: null,
          orgType: "funder",
          country: null,
          website: null,
          rorId: null,
          sourceUrl: w.id,
        },
        sourceUrl: w.id,
      });
    }
  }
  return [...byKey.values()];
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
    primaryOrgName: null,
    sourceUrl: a.id,
  };
}
