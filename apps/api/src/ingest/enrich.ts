import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { eq, isNotNull, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { organizations, people, projectMembers } from "../db/schema.js";
import { oaGet, oaPaginate } from "./http.js";
import { extractAuthorships, normalizeWork } from "./enrich-normalize.js";
import { matchPersonToExisting } from "./resolve.js";
import { resolveAuthorToOpenAlex, resolveOrgToRor } from "./openalex-resolve.js";
import {
  upsertProjectPublication,
  upsertPublication,
  upsertPublicationAuthor,
} from "./upsert.js";
import type { Adapter, IngestSummary, ProvInput } from "./types.js";

const SOURCE: ProvInput = { source: "enrichment", ingestMethod: "enrichment" };
const WORKS_CAP = Number(process.env.ENRICH_WORKS_CAP ?? 50);
const LIVE = process.env.INGEST_LIVE === "1";
const WORKS_SELECT = "id,doi,title,publication_date,primary_location,authorships";

/** Live → page OpenAlex by author id; offline → read a committed works fixture. */
async function fetchWorksForAuthor(openalexAuthorId: string): Promise<unknown[]> {
  if (LIVE) {
    return oaPaginate<unknown>("works", `author.id:${openalexAuthorId}`, WORKS_CAP, { select: WORKS_SELECT });
  }
  const path = fileURLToPath(new URL(`./__fixtures__/works.${openalexAuthorId}.json`, import.meta.url));
  if (!existsSync(path)) return [];
  const data = JSON.parse(readFileSync(path, "utf8")) as { results?: unknown[] };
  return (data.results ?? []).slice(0, WORKS_CAP);
}

/** Resolve an authorship's institution ROR to an in-graph org id (or null). */
async function orgIdForRor(ror: string | null): Promise<string | null> {
  if (!ror) return null;
  const [o] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.rorId, ror)).limit(1);
  return o?.id ?? null;
}

/** Live: turn an ORCID into an OpenAlex author id (for orcid-only people). */
async function orcidToOpenAlexId(orcid: string): Promise<string | null> {
  try {
    const a = await oaGet<{ id: string }>(`authors/orcid:${orcid}`);
    return a.id.replace(/\/+$/, "").split("/").pop() ?? null;
  } catch {
    return null;
  }
}

export const enrichAdapter: Adapter = {
  name: "enrich",
  async run(): Promise<IngestSummary> {
    const summary: IngestSummary = {
      upserts: { publications: 0, publication_authors: 0, project_publications: 0, resolved_people: 0, resolved_orgs: 0 },
      skipped: [],
    };

    // --- Pass 1: resolution (live only — search responses can't be fixtured). ---
    if (LIVE) {
      const orgs = await db
        .select({ id: organizations.id, name: organizations.name, country: organizations.country })
        .from(organizations)
        .where(sql`ror_id is null`);
      for (const o of orgs) {
        try {
          const ror = await resolveOrgToRor(o.name, o.country);
          if (ror) {
            await db.update(organizations).set({ rorId: ror }).where(eq(organizations.id, o.id));
            summary.upserts.resolved_orgs++;
          }
        } catch (err) {
          summary.skipped.push(`resolve org "${o.name}": ${String(err)}`);
        }
      }

      const unresolved = await db
        .select({ id: people.id, fullName: people.fullName, primaryOrgId: people.primaryOrgId })
        .from(people)
        .where(sql`orcid is null and openalex_author_id is null`);
      for (const pr of unresolved) {
        if (!pr.primaryOrgId) continue;
        const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, pr.primaryOrgId)).limit(1);
        try {
          const hit = await resolveAuthorToOpenAlex(pr.fullName, org?.name ?? null);
          if (hit) {
            await db.update(people).set({ openalexAuthorId: hit.openalexAuthorId }).where(eq(people.id, pr.id));
            summary.upserts.resolved_people++;
          }
        } catch (err) {
          summary.skipped.push(`resolve author "${pr.fullName}": ${String(err)}`);
        }
      }
    }

    // --- Pass 2: works → publications → author-membership links. ---
    const enrichable = await db
      .select({ id: people.id, orcid: people.orcid, openalexAuthorId: people.openalexAuthorId })
      .from(people)
      .where(or(isNotNull(people.orcid), isNotNull(people.openalexAuthorId)));

    for (const person of enrichable) {
      let authorId = person.openalexAuthorId;
      if (!authorId && LIVE && person.orcid) authorId = await orcidToOpenAlexId(person.orcid);
      if (!authorId) continue; // need an OpenAlex author id to fetch works

      let works: unknown[];
      try {
        works = await fetchWorksForAuthor(authorId);
      } catch (err) {
        summary.skipped.push(`fetch works ${authorId}: ${String(err)}`);
        continue;
      }
      if (works.length === WORKS_CAP) summary.skipped.push(`works capped at ${WORKS_CAP} for ${authorId}`);

      for (const work of works) {
        try {
          const pub = normalizeWork(work);
          if (!pub) continue;
          const pubId = await upsertPublication(pub, SOURCE);
          summary.upserts.publications++;

          const linkedPersonIds = new Set<string>();
          for (const a of extractAuthorships(work)) {
            const orgId = await orgIdForRor(a.instRor);
            const match = await matchPersonToExisting({
              orcid: a.orcid,
              openalexAuthorId: a.openalexAuthorId,
              normalisedName: a.rawName.toLowerCase().trim(),
              orgId,
            });
            if (!match) continue;
            await upsertPublicationAuthor(pubId, match.personId, a.position, match.confidence, pub.sourceUrl, SOURCE);
            summary.upserts.publication_authors++;
            linkedPersonIds.add(match.personId);
          }

          for (const personId of linkedPersonIds) {
            const memberships = await db
              .select({ projectId: projectMembers.projectId })
              .from(projectMembers)
              .where(eq(projectMembers.personId, personId));
            for (const m of memberships) {
              await upsertProjectPublication(m.projectId, pubId, pub.sourceUrl, SOURCE);
              summary.upserts.project_publications++;
            }
          }
        } catch (err) {
          summary.skipped.push(`work for ${authorId}: ${String(err)}`);
        }
      }
    }
    return summary;
  },
};
