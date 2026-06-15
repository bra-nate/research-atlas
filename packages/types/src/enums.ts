/**
 * Shared enums for the Research Directory data model. Self-contained: no imports,
 * safe to copy. Mirrors the Postgres enums in the first migration and DATA.md.
 */

// What kind of organisation a row represents.
export const ORG_TYPE_VALUES = [
  "ace",
  "university",
  "research_centre",
  "consortium",
  "institute",
  "funder",
  "company",
] as const;
export type OrgType = (typeof ORG_TYPE_VALUES)[number];

// Provenance lifecycle. V1 only ever sets 'ingested_unverified'; claimed/verified
// arrive with the V2 "claim your profile" flow.
export const VERIFICATION_STATUS_VALUES = [
  "ingested_unverified",
  "claimed",
  "verified",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUS_VALUES)[number];

// How a record entered the graph.
export const INGEST_METHOD_VALUES = [
  "manual",
  "csv",
  "scrape",
  "api",
  "enrichment",
] as const;
export type IngestMethod = (typeof INGEST_METHOD_VALUES)[number];

// A person's role on a project (project_members edge).
export const MEMBER_ROLE_VALUES = [
  "pi",
  "co_pi",
  "investigator",
  "fellow",
  "student",
  "collaborator",
] as const;
export type MemberRole = (typeof MEMBER_ROLE_VALUES)[number];

// An organisation's role on a project (project_partners edge).
export const PARTNER_ROLE_VALUES = ["lead", "hub", "partner", "funder"] as const;
export type PartnerRole = (typeof PARTNER_ROLE_VALUES)[number];

// Capability flavour.
export const CAPABILITY_KIND_VALUES = [
  "equipment",
  "facility",
  "service",
] as const;
export type CapabilityKind = (typeof CAPABILITY_KIND_VALUES)[number];
