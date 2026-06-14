/**
 * Person — the generalised shape of an ACE expert.
 *
 * In ACE Connect this row is the DB table `people` (renamed from `experts`).
 * The DB foreign-key column remains physically named `centre_id`, but the
 * shared shape exposes it generically as `organization_id`. New external-id
 * and de-duplication columns (orcid, openalex_author_id, normalised_name,
 * merged_into) make the shape ready for the Directory's identity-resolution.
 */
import type {
  AvailabilityBasis,
  AvailabilityStatus,
  CredentialStatus,
} from "./enums.js";

export interface Person {
  id: string;
  organization_id: string;

  // Identity
  full_name: string;
  normalised_name: string | null; // lowercased/stripped, for dedup & matching
  title: string | null;
  highest_qualification: string | null;

  // Expertise
  specializations: string[];
  skills: string[];
  bio: string | null;
  photo_url: string | null;

  // External identifiers (for cross-source identity resolution)
  orcid: string | null;
  openalex_author_id: string | null;

  // De-duplication: when two rows are merged, the loser points at the winner.
  merged_into: string | null;

  // Availability / credentials (ACE collaboration semantics, kept verbatim)
  availability_basis: AvailabilityBasis[];
  availability_status: AvailabilityStatus;
  credential_status: CredentialStatus;

  // Visibility & management
  visible: boolean;
  self_managed: boolean;

  last_verified_at: string | null; // ISO timestamp
}

/** Columns accepted when creating/updating a Person. */
export type PersonInput = Partial<Omit<Person, "id">> &
  Pick<Person, "organization_id" | "full_name">;
