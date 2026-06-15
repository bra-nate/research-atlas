import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { people, programs, projectMembers, projects } from "../db/schema.js";
import type { Adapter, IngestSummary } from "./types.js";

interface Fixture {
  programmes: { key: string; name: string; short_name: string; source_url: string }[];
  consortia: { key: string; title: string; programme: string; country: string; source_url: string }[];
  people: { key: string; full_name: string; orcid: string; source_url: string }[];
  memberships: { person: string; consortium: string; role: string }[];
}

const prov = (sourceUrl: string) => ({
  source: "curated",
  sourceUrl,
  ingestMethod: "manual" as const,
  ingestedAt: new Date(),
  verificationStatus: "ingested_unverified" as const,
});

export const seedConsortiaAdapter: Adapter = {
  name: "seed-consortia",
  async run(): Promise<IngestSummary> {
    const fx = JSON.parse(
      readFileSync(fileURLToPath(new URL("./seeds/consortia.json", import.meta.url)), "utf8"),
    ) as Fixture;
    const summary: IngestSummary = { upserts: { programs: 0, projects: 0, people: 0, project_members: 0 }, skipped: [] };

    const progId = new Map<string, string>();
    for (const p of fx.programmes) {
      const [existing] = await db.select({ id: programs.id }).from(programs).where(sql`lower(name) = lower(${p.name})`).limit(1);
      const values = { name: p.name, shortName: p.short_name, ...prov(p.source_url) };
      const id = existing
        ? (await db.update(programs).set(values).where(eq(programs.id, existing.id)), existing.id)
        : (await db.insert(programs).values(values).returning({ id: programs.id }))[0].id;
      progId.set(p.key, id);
      summary.upserts.programs++;
    }

    const projId = new Map<string, string>();
    for (const c of fx.consortia) {
      const [existing] = await db.select({ id: projects.id }).from(projects).where(sql`lower(title) = lower(${c.title})`).limit(1);
      const values = { title: c.title, programId: progId.get(c.programme) ?? null, country: c.country, ...prov(c.source_url) };
      const id = existing
        ? (await db.update(projects).set(values).where(eq(projects.id, existing.id)), existing.id)
        : (await db.insert(projects).values(values).returning({ id: projects.id }))[0].id;
      projId.set(c.key, id);
      summary.upserts.projects++;
    }

    const personId = new Map<string, string>();
    for (const p of fx.people) {
      const [existing] = await db.select({ id: people.id }).from(people).where(eq(people.orcid, p.orcid)).limit(1);
      const values = { fullName: p.full_name, normalisedName: p.full_name.toLowerCase().trim(), orcid: p.orcid, ...prov(p.source_url) };
      const id = existing
        ? (await db.update(people).set(values).where(eq(people.id, existing.id)), existing.id)
        : (await db.insert(people).values(values).returning({ id: people.id }))[0].id;
      personId.set(p.key, id);
      summary.upserts.people++;
    }

    for (const m of fx.memberships) {
      const pid = projId.get(m.consortium);
      const persId = personId.get(m.person);
      if (!pid || !persId) { summary.skipped.push(`membership ${m.person}->${m.consortium}: unresolved key`); continue; }
      const [existing] = await db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(sql`project_id = ${pid} and person_id = ${persId} and role = ${m.role}`)
        .limit(1);
      if (!existing) {
        await db.insert(projectMembers).values({ projectId: pid, personId: persId, role: m.role as never, ...prov("https://waccbip.org") });
      }
      summary.upserts.project_members++;
    }
    return summary;
  },
};
