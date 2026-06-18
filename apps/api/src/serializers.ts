/**
 * Map Drizzle rows to the shared @research-atlas/types JSON shapes. The API
 * speaks the shared vocabulary on the wire so the SPA consumes one model.
 */
import type {
  Capability,
  Grant,
  Organization,
  Person,
  Program,
  Project,
  ProjectMember,
  ProjectPartner,
  Provenance,
  Publication,
  PublicationAuthor,
} from "@research-atlas/types";
import type {
  capabilities,
  grants,
  organizations,
  people,
  programs,
  projectMembers,
  projectPartners,
  projects,
  publicationAuthors,
  publications,
} from "./db/schema.js";

const iso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString() : null;

type ProvenanceRow = {
  source: string | null;
  sourceUrl: string | null;
  ingestMethod: Provenance["ingest_method"];
  ingestedAt: Date | null;
  verificationStatus: Provenance["verification_status"];
};

function prov(r: ProvenanceRow): Provenance {
  return {
    source: r.source,
    source_url: r.sourceUrl,
    ingest_method: r.ingestMethod,
    ingested_at: iso(r.ingestedAt),
    verification_status: r.verificationStatus,
  };
}

export function toOrganization(r: typeof organizations.$inferSelect): Organization {
  return {
    id: r.id,
    name: r.name,
    short_name: r.shortName,
    org_type: r.orgType,
    country: r.country,
    description: r.description,
    website: r.website,
    logo_url: r.logoUrl,
    ror_id: r.rorId,
    last_verified_at: iso(r.lastVerifiedAt),
    ...prov(r),
  };
}

export function toPerson(r: typeof people.$inferSelect): Person {
  return {
    id: r.id,
    full_name: r.fullName,
    normalised_name: r.normalisedName,
    title: r.title,
    primary_org_id: r.primaryOrgId,
    highest_qualification: r.highestQualification,
    specializations: r.specializations ?? [],
    skills: r.skills ?? [],
    bio: r.bio,
    orcid: r.orcid,
    openalex_author_id: r.openalexAuthorId,
    works_count: r.worksCount,
    last_active_year: r.lastActiveYear,
    profile_url: r.profileUrl,
    photo_url: r.photoUrl,
    visible: r.visible,
    merged_into: r.mergedInto,
    ...prov(r),
  };
}

export function toCapability(r: typeof capabilities.$inferSelect): Capability {
  return {
    id: r.id,
    org_id: r.orgId,
    kind: r.kind,
    name: r.name,
    category: r.category,
    description: r.description,
    access_note: r.accessNote,
    country: r.country,
    city: r.city,
    ...prov(r),
  };
}

export function toProgram(r: typeof programs.$inferSelect): Program {
  return {
    id: r.id,
    name: r.name,
    short_name: r.shortName,
    funders: r.funders ?? [],
    focus_areas: r.focusAreas ?? [],
    region: r.region,
    website: r.website,
    description: r.description,
    logo_url: r.logoUrl,
    ...prov(r),
  };
}

export function toProject(r: typeof projects.$inferSelect): Project {
  return {
    id: r.id,
    program_id: r.programId,
    title: r.title,
    lead_org_id: r.leadOrgId,
    pi_person_id: r.piPersonId,
    status: r.status,
    themes: r.themes ?? [],
    funding_note: r.fundingNote,
    country: r.country,
    description: r.description,
    ...prov(r),
  };
}

export function toGrant(r: typeof grants.$inferSelect): Grant {
  return {
    id: r.id,
    name: r.name,
    funder_org_id: r.funderOrgId,
    award_number: r.awardNumber,
    amount: r.amount === null ? null : Number(r.amount),
    currency: r.currency,
    start_date: r.startDate,
    end_date: r.endDate,
    description: r.description,
    ...prov(r),
  };
}

export function toPublication(r: typeof publications.$inferSelect): Publication {
  return {
    id: r.id,
    title: r.title,
    doi: r.doi,
    openalex_id: r.openalexId,
    journal: r.journal,
    publication_date: r.publicationDate,
    abstract: r.abstract,
    url: r.url,
    ...prov(r),
  };
}

export function toProjectMember(r: typeof projectMembers.$inferSelect): ProjectMember {
  return {
    id: r.id,
    project_id: r.projectId,
    person_id: r.personId,
    role: r.role,
    ...prov(r),
  };
}

export function toProjectPartner(r: typeof projectPartners.$inferSelect): ProjectPartner {
  return {
    id: r.id,
    project_id: r.projectId,
    org_id: r.orgId,
    role: r.role,
    ...prov(r),
  };
}

export function toPublicationAuthor(
  r: typeof publicationAuthors.$inferSelect,
): PublicationAuthor {
  return {
    id: r.id,
    publication_id: r.publicationId,
    person_id: r.personId,
    author_position: r.authorPosition,
    match_confidence: r.matchConfidence != null ? Number(r.matchConfidence) : null,
    ...prov(r),
  };
}
