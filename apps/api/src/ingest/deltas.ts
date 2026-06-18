import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseDeltas } from "./deltas-normalize.js";
import { upsertProject } from "./upsert.js";
import type { Adapter, IngestSummary, ProvInput } from "./types.js";

// DELTAS Africa — programme metadata reconciled to the AAS portal API record
// (portal.aasciences.app/api/programmes, id 3), consortia curated from public
// record (the API does not expose them). ingest_method "manual" (curated).
const SOURCE: ProvInput = { source: "deltas", ingestMethod: "manual" };

function loadJson(): string {
  return readFileSync(
    fileURLToPath(new URL("./__fixtures__/deltas.consortia.json", import.meta.url)),
    "utf8",
  );
}

export const deltasAdapter: Adapter = {
  name: "deltas",
  async run(): Promise<IngestSummary> {
    const summary: IngestSummary = { upserts: { projects: 0 }, skipped: [] };
    const projects = parseDeltas(loadJson());
    for (const proj of projects) {
      try {
        await upsertProject(proj, SOURCE);
        summary.upserts.projects++;
      } catch (err) {
        summary.skipped.push(`consortium "${proj.title}": ${String(err)}`);
      }
    }
    return summary;
  },
};
