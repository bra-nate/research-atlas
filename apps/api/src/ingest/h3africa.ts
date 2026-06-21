import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { httpGet } from "./scrape-http.js";
import { parseH3Africa } from "./h3africa-normalize.js";
import { upsertProject } from "./upsert.js";
import type { Adapter, IngestSummary, ProvInput } from "./types.js";

// H3Africa (Human Heredity and Health in Africa, NIH Common Fund) — sourced from
// the NIH RePORTER API, filtered to the programme's funding opportunities.
// ingest_method "api" (not a web scrape).
const SOURCE: ProvInput = { source: "h3africa", ingestMethod: "api" };
const REPORTER_URL = "https://api.reporter.nih.gov/v2/projects/search";
const QUERY = {
  criteria: {
    opportunity_numbers: ["RFA-RM-16-015", "RFA-RM-16-016", "RFA-RM-17-020", "RFA-RM-17-021"],
  },
  include_fields: [
    "ApplId",
    "ProjectTitle",
    "PrincipalInvestigators",
    "Organization",
    "ProjectNum",
    "CoreProjectNum",
    "FiscalYear",
    "OpportunityNumber",
    "AwardAmount",
    "ProjectStartDate",
    "ProjectEndDate",
  ],
  offset: 0,
  limit: 500,
  sort_field: "fiscal_year",
  sort_order: "desc",
};

async function loadJson(): Promise<string> {
  if (process.env.INGEST_LIVE === "1") {
    return httpGet(REPORTER_URL, { method: "POST", body: JSON.stringify(QUERY) });
  }
  return readFileSync(
    fileURLToPath(new URL("./__fixtures__/h3africa.reporter.json", import.meta.url)),
    "utf8",
  );
}

export const h3africaAdapter: Adapter = {
  name: "h3africa",
  async run(): Promise<IngestSummary> {
    const summary: IngestSummary = { upserts: { projects: 0 }, skipped: [] };
    const projects = parseH3Africa(await loadJson());
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
