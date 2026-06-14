/**
 * Map Drizzle rows (camelCase, physical column quirks) to the shared @research-atlas/types
 * JSON shapes (snake_case, generic `organization_id`). The API speaks the shared
 * vocabulary on the wire so the SPA — and later the Directory — consume one
 * model.
 */
import type { Capability, Organization, Person } from "@research-atlas/types";
import type { capabilities, organizations, people } from "./db/schema.js";

type OrgRow = typeof organizations.$inferSelect;
type PersonRow = typeof people.$inferSelect;
type CapabilityRow = typeof capabilities.$inferSelect;

const iso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString() : null;

export function toOrganization(r: OrgRow): Organization {
  return {
    id: r.id,
    org_type: r.orgType,
    name: r.name,
    short_name: r.shortName,
    country: r.country,
    thematic_areas: r.thematicAreas ?? [],
    description: r.description,
    website: r.website,
    logo_url: r.logoUrl,
    ror_id: r.rorId,
    host_university: r.hostUniversity,
    ace_phase: r.acePhase as Organization["ace_phase"],
    source: r.source,
    source_url: r.sourceUrl,
    ingested_at: iso(r.ingestedAt),
    verification_status: r.verificationStatus,
    last_verified_at: iso(r.lastVerifiedAt),
    created_at: iso(r.createdAt) ?? "",
    updated_at: iso(r.updatedAt) ?? "",
  };
}

export function toPerson(r: PersonRow): Person {
  return {
    id: r.id,
    organization_id: r.organizationId,
    full_name: r.fullName,
    normalised_name: r.normalisedName,
    title: r.title,
    highest_qualification: r.highestQualification,
    specializations: r.specializations ?? [],
    skills: r.skills ?? [],
    bio: r.bio,
    photo_url: r.photoUrl,
    orcid: r.orcid,
    openalex_author_id: r.openalexAuthorId,
    merged_into: r.mergedInto,
    availability_basis: r.availabilityBasis ?? [],
    availability_status: r.availabilityStatus,
    credential_status: r.credentialStatus,
    visible: r.visible,
    self_managed: r.selfManaged,
    last_verified_at: iso(r.lastVerifiedAt),
  };
}

export function toCapability(r: CapabilityRow): Capability {
  return {
    id: r.id,
    organization_id: r.organizationId,
    kind: r.kind,
    name: r.name,
    category: r.category,
    description: r.description,
    access_basis: r.accessBasis ?? [],
    availability_note: r.availabilityNote,
    photo_url: r.photoUrl,
    offered_to: (r.offeredTo ?? []) as Capability["offered_to"],
    last_verified_at: iso(r.lastVerifiedAt),
  };
}
