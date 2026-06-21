import type { ProjectUpsert } from "./types.js";
import { parseReporter } from "./reporter-normalize.js";

/**
 * H3Africa (Human Heredity and Health in Africa, NIH Common Fund) is ingested from
 * the NIH RePORTER API (https://api.reporter.nih.gov/v2/projects/search), filtered
 * to its funding opportunities: RFA-RM-16-015 (research projects, U01),
 * RFA-RM-16-016 (collaborative centres, U54), RFA-RM-17-020 / RFA-RM-17-021 (ELSI
 * centres and projects). The committed fixture is a raw RePORTER response;
 * normalisation is shared with the other RePORTER-sourced programmes (see
 * reporter-normalize.ts). NIH-funded awards only — H3Africa's Wellcome Trust
 * co-funded work is not in RePORTER and is out of scope for this adapter.
 */
export function parseH3Africa(jsonText: string): ProjectUpsert[] {
  // Canonical programme name matches the seed (consortia.json) so the NIH-sourced
  // awards and the curated SickleGenAfrica consortium resolve to one programme row.
  return parseReporter(jsonText, {
    programName: "Human Heredity and Health in Africa",
    fallbackSourceUrl: "https://h3africa.org",
  });
}
