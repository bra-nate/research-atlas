import type { GrantUpsert, MemberEdge, OrgUpsert, PersonUpsert, ProjectUpsert } from "./types.js";

/**
 * DS-I Africa (NIH Common Fund) is ingested from the NIH RePORTER API
 * (https://api.reporter.nih.gov/v2/projects/search), filtered to the programme's
 * funding opportunities: RFA-RM-20-015 (research hubs), RFA-RM-20-017 (ELSI),
 * RFA-RM-20-018 (eLwazi data-science platform). The committed fixture is a raw
 * RePORTER response; this module normalises it. RePORTER does not carry ORCID or
 * ROR, so people resolve by name+org and orgs by name (see resolve.ts / upsert.ts).
 */

interface ReporterPI {
  full_name?: string;
  is_contact_pi?: boolean;
}
interface ReporterOrg {
  org_name?: string | null;
  org_country?: string | null;
}
interface ReporterResult {
  appl_id?: number;
  core_project_num?: string | null;
  fiscal_year?: number | null;
  project_title?: string | null;
  opportunity_number?: string | null;
  award_amount?: number | null;
  project_start_date?: string | null;
  project_end_date?: string | null;
  principal_investigators?: ReporterPI[];
  organization?: ReporterOrg | null;
}
interface ReporterResponse {
  results: ReporterResult[];
}

/** "UNIVERSITY OF CAPE TOWN" → "University Of Cape Town" (display + match parity). */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .trim();
}

function org(name: string, country: string | null): OrgUpsert {
  return {
    name: titleCase(name),
    shortName: null,
    orgType: "university",
    country: country ? titleCase(country) : null,
    website: null,
    rorId: null,
    sourceUrl: "https://dsi-africa.org",
  };
}

function person(fullName: string, sourceUrl: string, primaryOrgName: string): PersonUpsert {
  return {
    fullName: fullName.trim(),
    orcid: null,
    openalexAuthorId: null,
    specializations: [],
    worksCount: null,
    lastActiveYear: null,
    primaryOrgRor: null,
    primaryOrgName,
    sourceUrl,
  };
}

/** Strip RePORTER's stray leading/trailing quotes from some titles. */
function cleanTitle(t: string): string {
  return t.replace(/^["']+|["']+$/g, "").trim();
}

const NIH_FUNDER: OrgUpsert = {
  name: "National Institutes of Health (NIH)",
  shortName: "NIH",
  orgType: "funder",
  country: "United States",
  website: "https://www.nih.gov",
  rorId: null,
  sourceUrl: "https://reporter.nih.gov",
};

/** "2021-09-20T00:00:00" → "2021-09-20"; null/empty → null. */
function isoDate(d: string | null | undefined): string | null {
  return d ? d.slice(0, 10) : null;
}

/** Build the NIH grant for an award, keyed by its core project number. */
function grantFor(r: ReporterResult, sourceUrl: string): GrantUpsert | null {
  const award = r.core_project_num?.trim();
  if (!award) return null;
  return {
    name: `NIH ${award}`,
    awardNumber: award,
    amount: r.award_amount != null ? String(r.award_amount) : null,
    currency: r.award_amount != null ? "USD" : null,
    startDate: isoDate(r.project_start_date),
    endDate: isoDate(r.project_end_date),
    funder: { ...NIH_FUNDER, sourceUrl },
    sourceUrl,
  };
}

/**
 * Normalise a RePORTER response into one project per DS-I Africa core award
 * (collapsing the per-fiscal-year rows, keeping the latest year), with its lead
 * organisation, contact PI, and co-PIs as members.
 */
export function parseDsiAfrica(jsonText: string): ProjectUpsert[] {
  const data = JSON.parse(jsonText) as ReporterResponse;

  // Dedupe to the latest fiscal year per core project number.
  const latest = new Map<string, ReporterResult>();
  for (const r of data.results ?? []) {
    const core = r.core_project_num ?? r.project_title ?? "";
    if (!core) continue;
    const prev = latest.get(core);
    if (!prev || (r.fiscal_year ?? 0) > (prev.fiscal_year ?? 0)) latest.set(core, r);
  }

  const out: ProjectUpsert[] = [];
  for (const r of latest.values()) {
    const title = cleanTitle(r.project_title ?? "");
    const orgName = r.organization?.org_name?.trim();
    if (!title || !orgName) continue;

    const sourceUrl = r.appl_id
      ? `https://reporter.nih.gov/project-details/${r.appl_id}`
      : "https://dsi-africa.org";
    const leadOrg = org(orgName, r.organization?.org_country ?? null);

    const pis = r.principal_investigators ?? [];
    const contact = pis.find((p) => p.is_contact_pi && p.full_name) ?? pis.find((p) => p.full_name);
    const pi = contact?.full_name ? person(contact.full_name, sourceUrl, leadOrg.name) : null;
    const members: MemberEdge[] = pis
      .filter((p) => p.full_name && p.full_name !== contact?.full_name)
      .map((p) => ({ person: person(p.full_name!, sourceUrl, leadOrg.name), role: "co_pi" as const }));

    out.push({
      title,
      programName: "DS-I Africa",
      country: leadOrg.country,
      leadOrg,
      pi,
      partners: [{ org: leadOrg, role: "lead" }],
      members,
      grant: grantFor(r, sourceUrl),
      sourceUrl,
    });
  }
  return out;
}
