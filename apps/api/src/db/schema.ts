/**
 * Drizzle schema — the Research Directory's Postgres tables (see migration 0001).
 * Public read-only graph: entities + edges, every row carrying provenance.
 */
import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// --- enums -----------------------------------------------------------------
export const orgTypeEnum = pgEnum("org_type", [
  "ace",
  "university",
  "research_centre",
  "consortium",
  "institute",
  "funder",
  "company",
]);
export const verificationStatusEnum = pgEnum("verification_status", [
  "ingested_unverified",
  "claimed",
  "verified",
]);
export const ingestMethodEnum = pgEnum("ingest_method", [
  "manual",
  "csv",
  "scrape",
  "api",
  "enrichment",
]);
export const memberRoleEnum = pgEnum("member_role", [
  "pi",
  "co_pi",
  "investigator",
  "fellow",
  "student",
  "collaborator",
]);
export const partnerRoleEnum = pgEnum("partner_role", [
  "lead",
  "hub",
  "partner",
  "funder",
]);
export const capabilityKindEnum = pgEnum("capability_kind", [
  "equipment",
  "facility",
  "service",
]);

// Provenance columns shared by every ingested table.
const provenance = {
  source: text("source"),
  sourceUrl: text("source_url"),
  ingestMethod: ingestMethodEnum("ingest_method"),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }),
  verificationStatus: verificationStatusEnum("verification_status")
    .notNull()
    .default("ingested_unverified"),
};

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  shortName: text("short_name"),
  orgType: orgTypeEnum("org_type").notNull().default("university"),
  country: text("country"),
  description: text("description"),
  website: text("website"),
  logoUrl: text("logo_url"),
  rorId: text("ror_id"),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ...provenance,
});

export const people = pgTable("people", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  normalisedName: text("normalised_name"),
  title: text("title"),
  primaryOrgId: uuid("primary_org_id"),
  highestQualification: text("highest_qualification"),
  specializations: text("specializations").array().notNull().default([]),
  skills: text("skills").array().notNull().default([]),
  bio: text("bio"),
  orcid: text("orcid"),
  openalexAuthorId: text("openalex_author_id"),
  profileUrl: text("profile_url"),
  photoUrl: text("photo_url"),
  visible: boolean("visible").notNull().default(true),
  mergedInto: uuid("merged_into"),
  ...provenance,
});

export const programs = pgTable("programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  shortName: text("short_name"),
  funders: text("funders").array().notNull().default([]),
  focusAreas: text("focus_areas").array().notNull().default([]),
  region: text("region"),
  website: text("website"),
  description: text("description"),
  logoUrl: text("logo_url"),
  ...provenance,
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  programId: uuid("program_id"),
  title: text("title").notNull(),
  leadOrgId: uuid("lead_org_id"),
  piPersonId: uuid("pi_person_id"),
  status: text("status"),
  themes: text("themes").array().notNull().default([]),
  fundingNote: text("funding_note"),
  country: text("country"),
  description: text("description"),
  ...provenance,
});

export const capabilities = pgTable("capabilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  kind: capabilityKindEnum("kind").notNull(),
  name: text("name").notNull(),
  category: text("category"),
  description: text("description"),
  accessNote: text("access_note"),
  country: text("country"),
  city: text("city"),
  ...provenance,
});

export const grants = pgTable("grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  funderOrgId: uuid("funder_org_id"),
  awardNumber: text("award_number"),
  amount: numeric("amount"),
  currency: text("currency"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  description: text("description"),
  ...provenance,
});

export const publications = pgTable("publications", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  doi: text("doi"),
  openalexId: text("openalex_id"),
  journal: text("journal"),
  publicationDate: text("publication_date"),
  abstract: text("abstract"),
  url: text("url"),
  ...provenance,
});

export const projectMembers = pgTable("project_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  personId: uuid("person_id").notNull(),
  role: memberRoleEnum("role"),
  ...provenance,
});

export const projectPartners = pgTable("project_partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  orgId: uuid("org_id").notNull(),
  role: partnerRoleEnum("role"),
  ...provenance,
});

export const publicationAuthors = pgTable("publication_authors", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicationId: uuid("publication_id").notNull(),
  personId: uuid("person_id").notNull(),
  authorPosition: integer("author_position"),
  ...provenance,
});
