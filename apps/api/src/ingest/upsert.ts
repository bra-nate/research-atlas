import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { grants, organizations, people } from "../db/schema.js";
import type { GrantUpsert, OrgUpsert, PersonUpsert } from "./types.js";

const prov = (sourceUrl: string) => ({
  source: "openalex",
  sourceUrl,
  ingestMethod: "api" as const,
  ingestedAt: new Date(),
  verificationStatus: "ingested_unverified" as const,
});

/** Upsert an org by ror_id when present, else by lower(name). Returns its id. */
export async function upsertOrg(o: OrgUpsert): Promise<string> {
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
    ...prov(o.sourceUrl),
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
export async function upsertPerson(p: PersonUpsert): Promise<string> {
  let primaryOrgId: string | null = null;
  if (p.primaryOrgRor) {
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.rorId, p.primaryOrgRor)).limit(1);
    primaryOrgId = org?.id ?? null;
  }

  const found = p.orcid
    ? await db.select({ id: people.id }).from(people).where(eq(people.orcid, p.orcid)).limit(1)
    : p.openalexAuthorId
      ? await db.select({ id: people.id }).from(people).where(eq(people.openalexAuthorId, p.openalexAuthorId)).limit(1)
      : [];

  const values = {
    fullName: p.fullName,
    normalisedName: p.fullName.toLowerCase().trim(),
    specializations: p.specializations,
    orcid: p.orcid,
    openalexAuthorId: p.openalexAuthorId,
    worksCount: p.worksCount,
    lastActiveYear: p.lastActiveYear,
    primaryOrgId,
    ...prov(p.sourceUrl),
  };
  if (found[0]) {
    await db.update(people).set(values).where(eq(people.id, found[0].id));
    return found[0].id;
  }
  const [row] = await db.insert(people).values(values).returning({ id: people.id });
  return row.id;
}

/** Upsert a grant (and its funder org) keyed by funder name + award number. */
export async function upsertGrant(g: GrantUpsert): Promise<void> {
  const funderOrgId = await upsertOrg(g.funder);
  const existing = await db
    .select({ id: grants.id })
    .from(grants)
    .where(sql`lower(name) = lower(${g.name})`)
    .limit(1);
  const values = {
    name: g.name,
    funderOrgId,
    awardNumber: g.awardNumber,
    ...prov(g.sourceUrl),
  };
  if (existing[0]) {
    await db.update(grants).set(values).where(eq(grants.id, existing[0].id));
    return;
  }
  await db.insert(grants).values(values);
}
