/** Project — a consortium node (funded project / hub) under a programme. */
import type { Provenance } from "./provenance.js";

export interface Project extends Provenance {
  id: string;
  program_id: string | null;
  title: string;
  lead_org_id: string | null;
  pi_person_id: string | null;
  status: string | null;
  themes: string[];
  funding_note: string | null;
  country: string | null;
  description: string | null;
}
