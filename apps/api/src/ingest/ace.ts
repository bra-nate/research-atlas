import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseAce } from "./ace-normalize.js";
import { upsertProject } from "./upsert.js";
import type { Adapter, IngestSummary, ProvInput } from "./types.js";

// World Bank / AAU Africa Centres of Excellence (ACE) — sourced from the AAU
// "ACE Impact" 2019 thematic factsheets, transcribed into the committed fixture
// __fixtures__/ace.factsheets.json (see scripts/extract-ace-fixture.mts). ingest_method
// "manual" — curated/transcribed public data, not a live API or scrape.
const SOURCE: ProvInput = { source: "world-bank-ace", ingestMethod: "manual" };

function loadJson(): string {
  return readFileSync(
    fileURLToPath(new URL("./__fixtures__/ace.factsheets.json", import.meta.url)),
    "utf8",
  );
}

export const aceAdapter: Adapter = {
  name: "ace",
  async run(): Promise<IngestSummary> {
    const summary: IngestSummary = { upserts: { projects: 0 }, skipped: [] };
    const projects = parseAce(loadJson());
    for (const proj of projects) {
      try {
        await upsertProject(proj, SOURCE);
        summary.upserts.projects++;
      } catch (err) {
        summary.skipped.push(`centre "${proj.title}": ${String(err)}`);
      }
    }
    return summary;
  },
};
