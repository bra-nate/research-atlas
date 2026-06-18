/**
 * Edge tables — the graph that powers bidirectional Crunchbase-style navigation
 * (project → its people; person → every project/consortium they belong to).
 *
 * `project_members` and `project_partners` are from DATA.md. `publication_author`
 * is added here so research outputs can attach to people — DATA.md's edge section
 * was truncated when this was scaffolded; confirm/adjust when DATA.md is restored.
 */
import type { MemberRole, PartnerRole } from "./enums.js";
import type { Provenance } from "./provenance.js";

export interface ProjectMember extends Provenance {
  id: string;
  project_id: string;
  person_id: string;
  role: MemberRole | null;
}

export interface ProjectPartner extends Provenance {
  id: string;
  project_id: string;
  org_id: string;
  role: PartnerRole | null;
}

export interface PublicationAuthor extends Provenance {
  id: string;
  publication_id: string;
  person_id: string;
  author_position: number | null;
  match_confidence: number | null;
}

export interface ProjectGrant extends Provenance {
  id: string;
  project_id: string;
  grant_id: string;
}

export interface ProjectPublication extends Provenance {
  id: string;
  project_id: string;
  publication_id: string;
}
