/** Publication — a research output. doi / openalex_id are the resolution keys. */
import type { Provenance } from "./provenance.js";

export interface Publication extends Provenance {
  id: string;
  title: string;
  doi: string | null;
  openalex_id: string | null;
  journal: string | null;
  publication_date: string | null; // ISO date
  abstract: string | null;
  url: string | null;
}
