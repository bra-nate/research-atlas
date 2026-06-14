/**
 * Drizzle schema — the Research Directory's view of its Postgres tables.
 *
 * V1 seeds with the shared model entities inherited from ACE Connect's
 * re-platform (organizations, people, capabilities). The Directory-specific
 * graph (programs, projects, grants, publications, and edge tables) will be
 * added here as DATA.md is finalised — see ARCHITECTURE.md / DATA.md.
 *
 * No accounts/auth tables: V1 is public and read-only.
 *
 * NOTE: the FK column on people/capabilities is exposed generically as
 * `organizationId` (DB column `organization_id` in this product's own schema).
 */
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// --- enums (mirror the Postgres enums) -------------------------------------
export const orgTypeEnum = pgEnum("org_type", [
  "ace",
  "university",
  "research_institute",
  "company",
  "ngo",
  "government",
  "other",
]);
export const verificationStatusEnum = pgEnum("verification_status", [
  "seeded_unverified",
  "verified",
]);
export const availabilityStatusEnum = pgEnum("availability_status", [
  "open",
  "limited",
  "unavailable",
]);
export const availabilityBasisEnum = pgEnum("availability_basis", [
  "collaboration",
  "co_supervision",
  "external_examination",
  "advisory",
  "mentorship",
  "secondment",
  "paid_consulting",
]);
export const credentialStatusEnum = pgEnum("credential_status", [
  "self_declared",
  "verified",
]);
export const accessBasisEnum = pgEnum("access_basis", [
  "collaboration",
  "fee_for_service",
  "shared_use",
]);
export const capabilityKindEnum = pgEnum("capability_kind", [
  "equipment",
  "facility",
  "service",
]);

// --- organizations ---------------------------------------------------------
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgType: orgTypeEnum("org_type").notNull().default("ace"),
  name: text("name").notNull(),
  shortName: text("short_name"),
  country: text("country"),
  thematicAreas: text("thematic_areas").array().notNull().default([]),
  description: text("description"),
  website: text("website"),
  logoUrl: text("logo_url"),
  rorId: text("ror_id"),
  hostUniversity: text("host_university"),
  acePhase: text("ace_phase"),
  source: text("source"),
  sourceUrl: text("source_url"),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }),
  verificationStatus: verificationStatusEnum("verification_status")
    .notNull()
    .default("seeded_unverified"),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- people ----------------------------------------------------------------
export const people = pgTable("people", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  fullName: text("full_name").notNull(),
  normalisedName: text("normalised_name"),
  title: text("title"),
  highestQualification: text("highest_qualification"),
  specializations: text("specializations").array().notNull().default([]),
  skills: text("skills").array().notNull().default([]),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  orcid: text("orcid"),
  openalexAuthorId: text("openalex_author_id"),
  mergedInto: uuid("merged_into"),
  availabilityBasis: availabilityBasisEnum("availability_basis")
    .array()
    .notNull()
    .default([]),
  availabilityStatus: availabilityStatusEnum("availability_status")
    .notNull()
    .default("open"),
  credentialStatus: credentialStatusEnum("credential_status")
    .notNull()
    .default("self_declared"),
  visible: boolean("visible").notNull().default(true),
  selfManaged: boolean("self_managed").notNull().default(false),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
});

// --- capabilities ----------------------------------------------------------
export const capabilities = pgTable("capabilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  kind: capabilityKindEnum("kind").notNull(),
  name: text("name").notNull(),
  category: text("category"),
  description: text("description"),
  accessBasis: accessBasisEnum("access_basis").array().notNull().default([]),
  availabilityNote: text("availability_note"),
  photoUrl: text("photo_url"),
  offeredTo: text("offered_to").array().notNull().default([]),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
});
