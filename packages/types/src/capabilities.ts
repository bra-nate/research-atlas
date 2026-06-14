/**
 * Capability — the unified shape of an ACE equipment item or service.
 *
 * In ACE Connect this row is the DB table `capabilities`, backfilled from the
 * old `equipment` and `services` tables and discriminated by `kind`:
 *   - 'equipment' | 'facility' → physical resources (carries access_basis,
 *      availability_note, photo_url)
 *   - 'service'                → offered services (carries offered_to)
 *
 * Flavour-specific fields are nullable so a single shape covers both. The DB
 * foreign key remains physically named `centre_id`; the shared shape exposes
 * it generically as `organization_id`.
 */
import type {
  AccessBasis,
  CapabilityKind,
  OfferedTo,
} from "./enums.js";

export interface Capability {
  id: string;
  organization_id: string;

  kind: CapabilityKind;
  name: string;
  category: string | null;
  description: string | null;

  // Equipment/facility flavour
  access_basis: AccessBasis[];
  availability_note: string | null;
  photo_url: string | null;

  // Service flavour
  offered_to: OfferedTo[];

  last_verified_at: string | null; // ISO timestamp
}

/** Columns accepted when creating/updating a Capability. */
export type CapabilityInput = Partial<Omit<Capability, "id">> &
  Pick<Capability, "organization_id" | "kind" | "name">;
