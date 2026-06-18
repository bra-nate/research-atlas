import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { httpGet } from "./scrape-http.js";
import { parseDsiAfrica } from "./dsi-africa-normalize.js";
import { upsertProject } from "./upsert.js";
import type { Adapter, IngestSummary, ProvInput } from "./types.js";

// DS-I Africa (NIH Common Fund) — sourced from the NIH RePORTER API, filtered to
// the programme's funding opportunities. ingest_method "api" (not a web scrape).
const SOURCE: ProvInput = { source: "dsi-africa", ingestMethod: "api" };
const REPORTER_URL = "https://api.reporter.nih.gov/v2/projects/search";
const QUERY = {
  criteria: { opportunity_numbers: ["RFA-RM-20-015", "RFA-RM-20-017", "RFA-RM-20-018"] },
  include_fields: [
    "ApplId",
    "ProjectTitle",
    "PrincipalInvestigators",
    "Organization",
    "ProjectNum",
    "CoreProjectNum",
    "FiscalYear",
    "OpportunityNumber",
  ],
  offset: 0,
  limit: 100,
  sort_field: "fiscal_year",
  sort_order: "desc",
};

async function loadJson(): Promise<string> {
  if (process.env.INGEST_LIVE === "1") {
    return httpGet(REPORTER_URL, { method: "POST", body: JSON.stringify(QUERY) });
  }
  return readFileSync(
    fileURLToPath(new URL("./__fixtures__/dsi-africa.reporter.json", import.meta.url)),
    "utf8",
  );
}

export const dsiAfricaAdapter: Adapter = {
  name: "dsi-africa",
  async run(): Promise<IngestSummary> {
    const summary: IngestSummary = { upserts: { projects: 0 }, skipped: [] };
    const projects = parseDsiAfrica(await loadJson());
    for (const proj of projects) {
      try {
        await upsertProject(proj, SOURCE);
        summary.upserts.projects++;
      } catch (err) {
        summary.skipped.push(`award "${proj.title}": ${String(err)}`);
      }
    }
    return summary;
  },
};
