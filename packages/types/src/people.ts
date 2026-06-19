/**
 * Person — a researcher. Public, professional info only; NO contact fields ever
 * (directory non-negotiable). orcid + openalex_author_id are the entity-resolution
 * keys behind the hero feature (one person across every consortium).
 */
import type { Provenance } from "./provenance.js";

export interface Person extends Provenance {
  id: string;
  full_name: string;
  normalised_name: string | null; // lowercased/stripped, for dedup & matching
  title: string | null;
  primary_org_id: string | null;
  highest_qualification: string | null;
  specializations: string[];
  skills: string[];
  bio: string | null;
  orcid: string | null;
  openalex_author_id: string | null;
  profile_url: string | null; // link back to a public profile (not contact)
  photo_url: string | null;
  visible: boolean;
  merged_into: string | null; // when two rows resolve to one, loser → winner
  works_count: number | null;
  last_active_year: number | null;
}

/**
 * Person as returned by list/search endpoints — the base Person plus aggregate
 * counts used for the "in N consortia" chip and the cross-consortium hero list.
 */
export interface PersonListItem extends Person {
  consortia_count: number; // distinct programmes this person spans
}
