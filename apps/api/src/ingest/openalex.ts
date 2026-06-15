import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { oaGet, oaPaginate } from "./http.js";
import { normalizeAuthor, normalizeGrants, normalizeInstitution } from "./openalex-normalize.js";
import { upsertGrant, upsertOrg, upsertPerson } from "./upsert.js";
import type { Adapter, IngestSummary } from "./types.js";

const WORKS_CAP = Number(process.env.INGEST_WORKS_CAP ?? 200);
const AUTHORS_CAP = Number(process.env.INGEST_AUTHORS_CAP ?? 200);

function seed<T>(file: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./seeds/${file}`, import.meta.url)), "utf8")) as T;
}
const bareId = (url: string) => url.replace(/\/+$/, "").split("/").pop()!;

export const openalexAdapter: Adapter = {
  name: "openalex",
  async run(): Promise<IngestSummary> {
    const summary: IngestSummary = { upserts: { organizations: 0, people: 0, grants: 0 }, skipped: [] };
    const rors = seed<string[]>("institutions.ror.json");
    const orcids = seed<string[]>("people.orcid.json");

    // 1. Institutions → orgs, then their authors → people.
    for (const rorUrl of rors) {
      try {
        const inst = await oaGet<Record<string, unknown>>(`institutions/ror:${bareId(rorUrl)}`);
        await upsertOrg(normalizeInstitution(inst as never));
        summary.upserts.organizations++;

        const authors = await oaPaginate<Record<string, unknown>>(
          "authors",
          `affiliations.institution.id:${(inst as { id: string }).id}`,
          AUTHORS_CAP,
        );
        for (const a of authors) {
          await upsertPerson(normalizeAuthor(a as never));
          summary.upserts.people++;
        }
        if (authors.length === AUTHORS_CAP) summary.skipped.push(`authors capped at ${AUTHORS_CAP} for ${rorUrl}`);
      } catch (err) {
        summary.skipped.push(`institution ${rorUrl}: ${String(err)}`);
      }
    }

    // 2. Hero ORCIDs → people (+ their funders/grants, capped). Small set only.
    for (const orcid of orcids) {
      try {
        const author = await oaGet<{ id: string }>(`authors/orcid:${orcid}`);
        const personId = await upsertPerson(normalizeAuthor(author as never));
        if (personId) summary.upserts.people++;

        const works = await oaPaginate<Record<string, unknown>>("works", `author.id:${author.id}`, WORKS_CAP);
        for (const g of normalizeGrants(works as never)) {
          await upsertGrant(g);
          summary.upserts.grants++;
        }
        if (works.length === WORKS_CAP) summary.skipped.push(`works capped at ${WORKS_CAP} for ${orcid}`);
      } catch (err) {
        summary.skipped.push(`orcid ${orcid}: ${String(err)}`);
      }
    }
    return summary;
  },
};
