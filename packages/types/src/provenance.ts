/**
 * Provenance — every ingested record carries where it came from and how, plus
 * its verification lifecycle. The directory's first non-negotiable: nothing is
 * shown without a source + "unverified" label.
 */
import type { IngestMethod, VerificationStatus } from "./enums.js";

export interface Provenance {
  source: string | null;
  source_url: string | null;
  ingest_method: IngestMethod | null;
  ingested_at: string | null; // ISO timestamp
  verification_status: VerificationStatus;
}
