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
  /**
   * Name of the person's primary institution, used to resolve a primary org when
   * no ROR is available (RePORTER / curated sources). Lets name+org resolution
   * fire so re-runs stay idempotent. ROR takes precedence when both are present.
   */
  primaryOrgName: string | null;
  sourceUrl: string;
}

/** Normalized grant + its funder org. */
export interface GrantUpsert {
  name: string;
  awardNumber: string | null;
  amount: string | null;
  currency: string | null;
  startDate: string | null;
  endDate: string | null;
  funder: OrgUpsert;
  sourceUrl: string;
}

/** Per-record provenance descriptor passed into the upsert layer. */
export interface ProvInput {
  source: string;
  ingestMethod: "manual" | "csv" | "scrape" | "api" | "enrichment";
}

/** Normalised programme (umbrella initiative — ACE, DELTAS, DS-I Africa). */
export interface ProgramUpsert {
  name: string;
  shortName: string | null;
  region: string | null;
  website: string | null;
  sourceUrl: string;
}

/** A person on a project, with their role on it. */
export interface MemberEdge {
  person: PersonUpsert;
  role: "pi" | "co_pi" | "investigator" | "fellow" | "student" | "collaborator";
}

/** A partner organisation on a project, with its role on it. */
export interface PartnerEdge {
  org: OrgUpsert;
  role: "lead" | "hub" | "partner" | "funder";
}

/** Normalized publication (one OpenAlex work). */
export interface PublicationUpsert {
  title: string;
  doi: string | null;
  openalexId: string | null;
  journal: string | null;
  publicationDate: string | null;
  url: string | null;
  sourceUrl: string;
}

/** One authorship on a work, carrying resolution keys for matchPersonToExisting. */
export interface AuthorshipInput {
  orcid: string | null;
  openalexAuthorId: string | null;
  rawName: string;
  position: number;
  instRor: string | null;
}

/** Normalised project/consortium plus its programme, lead, PI and partners. */
export interface ProjectUpsert {
  title: string;
  programName: string;
  country: string | null;
  leadOrg: OrgUpsert | null;
  pi: PersonUpsert | null;
  partners: PartnerEdge[];
  members: MemberEdge[];
  grant: GrantUpsert | null;
  sourceUrl: string;
}
