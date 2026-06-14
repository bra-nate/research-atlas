/**
 * Human-readable labels for the shared enums. UI-facing but kept beside the
 * shapes so the Directory inherits the same wording when it copies this module.
 * Exhaustive Record keys mean adding an enum value surfaces a type error here.
 */
import type {
  AccessBasis,
  AvailabilityBasis,
  AvailabilityStatus,
  CapabilityKind,
  CredentialStatus,
  OfferedTo,
  OrgType,
  VerificationStatus,
} from "./enums.js";

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  ace: "ACE",
  university: "University",
  research_institute: "Research institute",
  company: "Company",
  ngo: "NGO",
  government: "Government",
  other: "Other",
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  seeded_unverified: "Illustrative — unverified",
  verified: "Verified",
};

export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  open: "Open",
  limited: "Limited",
  unavailable: "Unavailable",
};

export const AVAILABILITY_BASIS_LABELS: Record<AvailabilityBasis, string> = {
  collaboration: "Collaboration",
  co_supervision: "Co-supervision",
  external_examination: "External examination",
  advisory: "Advisory",
  mentorship: "Mentorship",
  secondment: "Secondment",
  paid_consulting: "Paid consulting",
};

export const CREDENTIAL_STATUS_LABELS: Record<CredentialStatus, string> = {
  self_declared: "Self-declared",
  verified: "Verified",
};

export const CAPABILITY_KIND_LABELS: Record<CapabilityKind, string> = {
  equipment: "Equipment",
  facility: "Facility",
  service: "Service",
};

export const ACCESS_BASIS_LABELS: Record<AccessBasis, string> = {
  collaboration: "Collaboration",
  fee_for_service: "Fee for service",
  shared_use: "Shared use",
};

export const OFFERED_TO_LABELS: Record<OfferedTo, string> = {
  students: "Students",
  researchers: "Researchers",
  industry: "Industry",
  other_centres: "Other centres",
  public: "Public",
};
