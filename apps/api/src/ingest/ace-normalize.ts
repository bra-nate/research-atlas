import type { OrgUpsert, PersonUpsert, ProjectUpsert } from "./types.js";

/**
 * World Bank / AAU Africa Centres of Excellence (ACE).
 *
 * Source is the committed fixture `__fixtures__/ace.factsheets.json`, extracted from
 * the old ACE Connect Postgres seed (itself transcribed from the AAU/World Bank
 * "ACE Impact" 2019 thematic factsheets). See scripts/extract-ace-fixture.mts.
 *
 * Each ACE centre becomes a project/consortium under the existing
 * "Africa Centres of Excellence" programme (already seeded — see seeds/consortia.json);
 * the programme name here matches that row exactly so everything resolves into it.
 * The host university is the lead org; the World Bank and AAU are funder/partner orgs;
 * each centre's faculty become `investigator` members. No grant figures exist in the
 * source, so grants are not asserted. `thematic_areas` and `ace_phase` have no slot on
 * ProjectUpsert and are dropped in V1 (a possible follow-up if a themes column lands).
 */

const PROGRAM_NAME = "Africa Centres of Excellence";
const PROGRAM_URL = "https://ace.aau.org";

/** Centre website is the best per-record source; fall back to the programme page. */
const sourceUrlFor = (website: string | null): string => website || PROGRAM_URL;

const worldBank = (sourceUrl: string): OrgUpsert => ({
  name: "World Bank Group",
  shortName: "World Bank",
  orgType: "funder",
  country: null,
  website: "https://www.worldbank.org",
  rorId: null,
  sourceUrl,
});

const aau = (sourceUrl: string): OrgUpsert => ({
  name: "Association of African Universities",
  shortName: "AAU",
  orgType: "institute",
  country: null,
  website: PROGRAM_URL,
  rorId: null,
  sourceUrl,
});

export interface AceExpert {
  full_name: string;
  title: string | null;
  specializations: string[];
}
export interface AceCentre {
  name: string;
  short_name: string;
  host_university: string | null;
  country: string | null;
  ace_phase: string | null;
  website: string | null;
  thematic_areas: string[];
  experts: AceExpert[];
}
interface AceFixture {
  centres: AceCentre[];
}

export function parseAce(jsonText: string): ProjectUpsert[] {
  const data = JSON.parse(jsonText) as AceFixture;
  const out: ProjectUpsert[] = [];

  for (const centre of data.centres ?? []) {
    const title = centre.name?.trim();
    if (!title) continue;
    const sourceUrl = sourceUrlFor(centre.website);

    // Host university name is kept verbatim — already well-formed (and often accented
    // / French); org resolution is lower(name)-keyed so cross-source merge is unaffected.
    const leadOrg: OrgUpsert | null = centre.host_university
      ? {
          name: centre.host_university,
          shortName: null,
          orgType: "university",
          country: centre.country,
          website: null,
          rorId: null,
          sourceUrl,
        }
      : null;

    const partners: ProjectUpsert["partners"] = [];
    if (leadOrg) partners.push({ org: leadOrg, role: "lead" });
    partners.push({ org: worldBank(sourceUrl), role: "funder" });
    partners.push({ org: aau(sourceUrl), role: "partner" });

    const members = centre.experts
      .filter((e) => e.full_name?.trim())
      .map((e): { person: PersonUpsert; role: "investigator" } => ({
        person: {
          fullName: e.full_name.trim(),
          orcid: null,
          openalexAuthorId: null,
          specializations: e.specializations ?? [],
          worksCount: null,
          lastActiveYear: null,
          primaryOrgRor: null,
          // Lets name+org resolution fire and sets the person's primary org.
          primaryOrgName: centre.host_university,
          sourceUrl,
        },
        role: "investigator",
      }));

    out.push({
      title,
      programName: PROGRAM_NAME,
      country: centre.country,
      leadOrg,
      // The factsheets don't reliably identify centre directors; assert no PI rather
      // than guess. Every named faculty is an investigator member.
      pi: null,
      partners,
      members,
      grant: null,
      sourceUrl,
    });
  }

  return out;
}
