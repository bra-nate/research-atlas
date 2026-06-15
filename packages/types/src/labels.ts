/** Human-readable labels for the Directory enums. */
import type {
  CapabilityKind,
  IngestMethod,
  MemberRole,
  OrgType,
  PartnerRole,
  VerificationStatus,
} from "./enums.js";

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  ace: "ACE",
  university: "University",
  research_centre: "Research centre",
  consortium: "Consortium",
  institute: "Institute",
  funder: "Funder",
  company: "Company",
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  ingested_unverified: "Unverified",
  claimed: "Claimed",
  verified: "Verified",
};

export const INGEST_METHOD_LABELS: Record<IngestMethod, string> = {
  manual: "Manual",
  csv: "CSV",
  scrape: "Scrape",
  api: "API",
  enrichment: "Enrichment",
};

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  pi: "Principal investigator",
  co_pi: "Co-PI",
  investigator: "Investigator",
  fellow: "Fellow",
  student: "Student",
  collaborator: "Collaborator",
};

export const PARTNER_ROLE_LABELS: Record<PartnerRole, string> = {
  lead: "Lead",
  hub: "Hub",
  partner: "Partner",
  funder: "Funder",
};

export const CAPABILITY_KIND_LABELS: Record<CapabilityKind, string> = {
  equipment: "Equipment",
  facility: "Facility",
  service: "Service",
};
