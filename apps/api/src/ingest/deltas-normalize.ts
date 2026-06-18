import type { OrgUpsert, PersonUpsert, ProjectUpsert } from "./types.js";

/**
 * DELTAS Africa structural tier. The AAS portal API
 * (portal.aasciences.app/api/programmes) exposes the DELTAS programme record but
 * not its consortia, so the consortium → lead-org → director tier is curated from
 * public record into __fixtures__/deltas.consortia.json. This module normalises
 * that fixture. People carry an ORCID where it is a known strong key (e.g. the
 * hero, Gordon Awandare); otherwise they resolve by name + shared org (resolve.ts).
 */

interface DeltasConsortium {
  title: string;
  abbreviation: string;
  director: string;
  orcid: string | null;
  leadOrg: string;
  country: string | null;
  sourceUrl: string;
}
interface DeltasFixture {
  programme: { name: string };
  consortia: DeltasConsortium[];
}

function org(name: string, country: string | null, sourceUrl: string): OrgUpsert {
  return {
    name: name.trim(),
    shortName: null,
    orgType: "university",
    country,
    website: null,
    rorId: null,
    sourceUrl,
  };
}

function person(
  fullName: string,
  orcid: string | null,
  sourceUrl: string,
  primaryOrgName: string,
): PersonUpsert {
  return {
    fullName: fullName.trim(),
    orcid,
    openalexAuthorId: null,
    specializations: [],
    worksCount: null,
    lastActiveYear: null,
    primaryOrgRor: null,
    primaryOrgName,
    sourceUrl,
  };
}

/** Normalise the curated DELTAS fixture into one project per consortium. */
export function parseDeltas(jsonText: string): ProjectUpsert[] {
  const data = JSON.parse(jsonText) as DeltasFixture;
  const programName = data.programme.name;
  return data.consortia.map((c) => {
    const leadOrg = org(c.leadOrg, c.country, c.sourceUrl);
    return {
      title: c.title,
      programName,
      country: c.country,
      leadOrg,
      pi: person(c.director, c.orcid, c.sourceUrl, leadOrg.name),
      partners: [{ org: leadOrg, role: "lead" as const }],
      members: [],
      grant: null,
      sourceUrl: c.sourceUrl,
    };
  });
}
