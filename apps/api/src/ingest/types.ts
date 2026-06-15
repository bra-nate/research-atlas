/**
 * Shared contracts for ingest adapters. An adapter pulls from one source and
 * writes through the upsert layer; the runner only knows this interface.
 */
export interface Adapter {
  /** Stable name used on the CLI: `pnpm ingest <name>`. */
  name: string;
  /** Fetch → normalize → upsert. Returns a summary for the runner to print. */
  run(): Promise<IngestSummary>;
}

/** Per-table counts plus anything skipped/capped (no silent truncation). */
export interface IngestSummary {
  upserts: Record<string, number>;
  skipped: string[];
}

/** Normalized organisation ready to upsert (institution or funder). */
export interface OrgUpsert {
  name: string;
  shortName: string | null;
  orgType: "university" | "research_centre" | "institute" | "funder";
  country: string | null;
  website: string | null;
  rorId: string | null;
  sourceUrl: string;
}

/** Normalized person ready to upsert (resolution keys carried). */
export interface PersonUpsert {
  fullName: string;
  orcid: string | null;
  openalexAuthorId: string | null;
  specializations: string[];
  worksCount: number | null;
  lastActiveYear: number | null;
  /** ROR of the person's primary institution, resolved to an org at upsert. */
  primaryOrgRor: string | null;
  sourceUrl: string;
}

/** Normalized grant + its funder org. */
export interface GrantUpsert {
  name: string;
  awardNumber: string | null;
  funder: OrgUpsert;
  sourceUrl: string;
}
