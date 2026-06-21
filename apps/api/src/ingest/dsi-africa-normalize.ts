import type { ProjectUpsert } from "./types.js";
import { parseReporter } from "./reporter-normalize.js";

/**
 * DS-I Africa (NIH Common Fund) is ingested from the NIH RePORTER API
 * (https://api.reporter.nih.gov/v2/projects/search), filtered to the programme's
 * funding opportunities: RFA-RM-20-015 (research hubs), RFA-RM-20-017 (ELSI),
 * RFA-RM-20-018 (eLwazi data-science platform). The committed fixture is a raw
 * RePORTER response; normalisation is shared with the other RePORTER-sourced
 * programmes (see reporter-normalize.ts).
 */
export function parseDsiAfrica(jsonText: string): ProjectUpsert[] {
  return parseReporter(jsonText, {
    programName: "DS-I Africa",
    fallbackSourceUrl: "https://dsi-africa.org",
  });
}
