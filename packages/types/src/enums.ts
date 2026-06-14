/**
 * Shared enums for the cross-product data model (organizations, people,
 * capabilities). Self-contained: this file has NO imports and is safe to copy
 * verbatim into the separate Research Directory repository.
 *
 * Each `*_VALUES` array is the runtime list (Select options, validation,
 * seeding); each corresponding type is the compile-time union. Keep these in
 * sync with the Postgres enums declared in the migration.
 *
 * NOTE: ACE-private enums (user_role, request_type, request_status,
 * outcome_type) deliberately live OUTSIDE this module — they belong to
 * collaboration tables that the Directory never mirrors.
 */

// --- org_type --------------------------------------------------------------
// Discriminates what kind of organization a row represents. Defaults to 'ace'
// in this product; the Directory will populate the other kinds.
export const ORG_TYPE_VALUES = [
  "ace",
  "university",
  "research_institute",
  "company",
  "ngo",
  "government",
  "other",
] as const;
export type OrgType = (typeof ORG_TYPE_VALUES)[number];

// --- ace_phase -------------------------------------------------------------
// ACE-specific funding phase. Nullable on the generic Organization shape.
export const ACE_PHASE_VALUES = ["ace_1", "ace_2", "ace_impact"] as const;
export type AcePhase = (typeof ACE_PHASE_VALUES)[number];

// --- verification_status ---------------------------------------------------
export const VERIFICATION_STATUS_VALUES = [
  "seeded_unverified",
  "verified",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUS_VALUES)[number];

// --- availability_status (people) ------------------------------------------
export const AVAILABILITY_STATUS_VALUES = [
  "open",
  "limited",
  "unavailable",
] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUS_VALUES)[number];

// --- availability_basis (people) -------------------------------------------
export const AVAILABILITY_BASIS_VALUES = [
  "collaboration",
  "co_supervision",
  "external_examination",
  "advisory",
  "mentorship",
  "secondment",
  "paid_consulting",
] as const;
export type AvailabilityBasis = (typeof AVAILABILITY_BASIS_VALUES)[number];

// --- credential_status (people) --------------------------------------------
export const CREDENTIAL_STATUS_VALUES = ["self_declared", "verified"] as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUS_VALUES)[number];

// --- capability_kind -------------------------------------------------------
// The discriminator that unifies the old equipment + services tables.
export const CAPABILITY_KIND_VALUES = [
  "equipment",
  "facility",
  "service",
] as const;
export type CapabilityKind = (typeof CAPABILITY_KIND_VALUES)[number];

// --- access_basis (capabilities, equipment-flavoured) ----------------------
export const ACCESS_BASIS_VALUES = [
  "collaboration",
  "fee_for_service",
  "shared_use",
] as const;
export type AccessBasis = (typeof ACCESS_BASIS_VALUES)[number];

// --- offered_to (capabilities, service-flavoured) --------------------------
export const OFFERED_TO_VALUES = [
  "students",
  "researchers",
  "industry",
  "other_centres",
  "public",
] as const;
export type OfferedTo = (typeof OFFERED_TO_VALUES)[number];
