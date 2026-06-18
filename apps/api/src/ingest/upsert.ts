import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  grants,
  organizations,
  people,
  programs,
  projectMembers,
  projectPartners,
  projects,
} from "../db/schema.js";
import type {
  GrantUpsert,
  OrgUpsert,
  PersonUpsert,
  ProgramUpsert,
  ProjectUpsert,
  ProvInput,
} from "./types.js";
import { matchPersonToExisting } from "./resolve.js";

const OPENALEX_PROV: ProvInput = { source: "openalex", ingestMethod: "api" };

const prov = (sourceUrl: string, p: ProvInput = OPENALEX_PROV) => ({
  source: p.source,
  sourceUrl,
  ingestMethod: p.ingestMethod,
  ingestedAt: new Date(),
  verificationStatus: "ingested_unverified" as const,
});

/** Upsert an org by ror_id when present, else by lower(name). Returns its id. */
export async function upsertOrg(o: OrgUpsert, p: ProvInput = OPENALEX_PROV): Promise<string> {
  const existing = o.rorId
    ? await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.rorId, o.rorId)).limit(1)
    : await db.select({ id: organizations.id }).from(organizations).where(sql`lower(name) = lower(${o.name})`).limit(1);

  const values = {
    name: o.name,
    shortName: o.shortName,
    orgType: o.orgType,
    country: o.country,
    website: o.website,
    rorId: o.rorId,
    updatedAt: new Date(),
    ...prov(o.sourceUrl, p),
  };
  if (existing[0]) {
    await db.update(organizations).set(values).where(eq(organizations.id, existing[0].id));
    return existing[0].id;
  }
  const [row] = await db.insert(organizations).values(values).returning({ id: organizations.id });
  return row.id;
}

/**
 * Upsert a person, resolving by orcid then openalex_author_id (the partial
 * unique keys). Links primary_org_id when the primary ROR resolves to an org.
 */
export async function upsertPerson(p: PersonUpsert, prv: ProvInput = OPENALEX_PROV): Promise<string> {
  let primaryOrgId: string | null = null;
  if (p.primaryOrgRor) {
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.rorId, p.primaryOrgRor)).limit(1);
    primaryOrgId = org?.id ?? null;
  }

  const normalisedName = p.fullName.toLowerCase().trim();
  const match = await matchPersonToExisting({
    orcid: p.orcid,
    openalexAuthorId: p.openalexAuthorId,
    normalisedName,
    orgId: primaryOrgId,
  });

  const values = {
    fullName: p.fullName,
    normalisedName,
    specializations: p.specializations,
    orcid: p.orcid,
    openalexAuthorId: p.openalexAuthorId,
    worksCount: p.worksCount,
    lastActiveYear: p.lastActiveYear,
    primaryOrgId,
    ...prov(p.sourceUrl, prv),
  };
  if (match) {
    // Never blank an existing strong key with an incoming null (a scraped
    // record may lack the ORCID the matched row already has).
    const [cur] = await db
      .select({ orcid: people.orcid, openalexAuthorId: people.openalexAuthorId })
      .from(people)
      .where(eq(people.id, match.personId))
      .limit(1);
    await db
      .update(people)
      .set({
        ...values,
        orcid: values.orcid ?? cur?.orcid ?? null,
        openalexAuthorId: values.openalexAuthorId ?? cur?.openalexAuthorId ?? null,
      })
      .where(eq(people.id, match.personId));
    return match.personId;
  }
  const [row] = await db.insert(people).values(values).returning({ id: people.id });
  return row.id;
}

/** Upsert a grant (and its funder org) keyed by funder name + award number. */
export async function upsertGrant(g: GrantUpsert, p: ProvInput = OPENALEX_PROV): Promise<void> {
  const funderOrgId = await upsertOrg(g.funder, p);
  const existing = await db
    .select({ id: grants.id })
    .from(grants)
    .where(sql`lower(name) = lower(${g.name})`)
    .limit(1);
  const values = {
    name: g.name,
    funderOrgId,
    awardNumber: g.awardNumber,
    ...prov(g.sourceUrl, p),
  };
  if (existing[0]) {
    await db.update(grants).set(values).where(eq(grants.id, existing[0].id));
    return;
  }
  await db.insert(grants).values(values);
}

/** Upsert a programme by lower(name). Returns its id. */
export async function upsertProgram(prog: ProgramUpsert, p: ProvInput): Promise<string> {
  const existing = await db
    .select({ id: programs.id })
    .from(programs)
    .where(sql`lower(name) = lower(${prog.name})`)
    .limit(1);
  const values = {
    name: prog.name,
    shortName: prog.shortName,
    region: prog.region,
    website: prog.website,
    ...prov(prog.sourceUrl, p),
  };
  if (existing[0]) {
    await db.update(programs).set(values).where(eq(programs.id, existing[0].id));
    return existing[0].id;
  }
  const [row] = await db.insert(programs).values(values).returning({ id: programs.id });
  return row.id;
}

/**
 * Upsert a project/consortium by lower(title), resolving its programme, lead org,
 * PI, partners, and member edges. Returns the project id.
 */
export async function upsertProject(proj: ProjectUpsert, p: ProvInput): Promise<string> {
  const programId = await upsertProgram(
    { name: proj.programName, shortName: null, region: null, website: null, sourceUrl: proj.sourceUrl },
    p,
  );
  const leadOrgId = proj.leadOrg ? await upsertOrg(proj.leadOrg, p) : null;
  const piPersonId = proj.pi ? await upsertPerson(proj.pi, p) : null;

  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(sql`lower(title) = lower(${proj.title})`)
    .limit(1);
  const values = {
    title: proj.title,
    programId,
    leadOrgId,
    piPersonId,
    country: proj.country,
    ...prov(proj.sourceUrl, p),
  };
  const projectId = existing[0]
    ? (await db.update(projects).set(values).where(eq(projects.id, existing[0].id)), existing[0].id)
    : (await db.insert(projects).values(values).returning({ id: projects.id }))[0].id;

  if (piPersonId) await upsertProjectMember(projectId, piPersonId, "pi", proj.sourceUrl, p);
  for (const m of proj.members) {
    const personId = await upsertPerson(m.person, p);
    await upsertProjectMember(projectId, personId, m.role, proj.sourceUrl, p);
  }
  for (const pt of proj.partners) {
    const orgId = await upsertOrg(pt.org, p);
    await upsertProjectPartner(projectId, orgId, pt.role, proj.sourceUrl, p);
  }
  return projectId;
}

/** Idempotent membership edge keyed on (project, person, role). */
export async function upsertProjectMember(
  projectId: string,
  personId: string,
  role: "pi" | "co_pi" | "investigator" | "fellow" | "student" | "collaborator",
  sourceUrl: string,
  p: ProvInput,
): Promise<void> {
  const existing = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(sql`project_id = ${projectId} and person_id = ${personId} and role = ${role}`)
    .limit(1);
  if (existing[0]) return;
  await db.insert(projectMembers).values({ projectId, personId, role, ...prov(sourceUrl, p) });
}

/** Idempotent partner edge keyed on (project, org, role). */
export async function upsertProjectPartner(
  projectId: string,
  orgId: string,
  role: "lead" | "hub" | "partner" | "funder",
  sourceUrl: string,
  p: ProvInput,
): Promise<void> {
  const existing = await db
    .select({ id: projectPartners.id })
    .from(projectPartners)
    .where(sql`project_id = ${projectId} and org_id = ${orgId} and role = ${role}`)
    .limit(1);
  if (existing[0]) return;
  await db.insert(projectPartners).values({ projectId, orgId, role, ...prov(sourceUrl, p) });
}
