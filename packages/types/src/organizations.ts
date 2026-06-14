/**
 * Organization — the generalised shape of an ACE centre.
 *
 * In ACE Connect this row is the DB table `organizations` (renamed from
 * `ace_centres`). The Research Directory will mirror this same shape for its
 * own organizations (universities, institutes, companies, ...). ACE-specific
 * fields (`ace_phase`, `host_university`) are nullable so the shape stays
 * generic enough to copy.
 */
import type {
  AcePhase,
  OrgType,
  VerificationStatus,
} from "./enums.js";

export interface Organization {
  id: string;

  // Discriminator + identity
  org_type: OrgType; // defaults to 'ace' in this product
  name: string;
  short_name: string | null;

  // Location / classification
  country: string | null;
  thematic_areas: string[];
  description: string | null;
  website: string | null;
  logo_url: string | null;

  // External identifiers (provenance-ready)
  ror_id: string | null;

  // ACE-specific (nullable on the generic shape)
  host_university: string | null;
  ace_phase: AcePhase | null;

  // Provenance — where this record came from and when it was ingested
  source: string | null;
  source_url: string | null;
  ingested_at: string | null; // ISO timestamp

  // Verification lifecycle
  verification_status: VerificationStatus;
  last_verified_at: string | null; // ISO timestamp

  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/** Columns accepted when creating/updating an Organization (server fills the rest). */
export type OrganizationInput = Partial<
  Omit<Organization, "id" | "created_at" | "updated_at">
> &
  Pick<Organization, "name">;
