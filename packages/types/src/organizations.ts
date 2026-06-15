/** Organization — an institution in the research ecosystem. */
import type { OrgType } from "./enums.js";
import type { Provenance } from "./provenance.js";

export interface Organization extends Provenance {
  id: string;
  name: string;
  short_name: string | null;
  org_type: OrgType;
  country: string | null;
  description: string | null;
  website: string | null;
  logo_url: string | null;
  ror_id: string | null; // Research Organization Registry id — entity resolution key
  last_verified_at: string | null;
}
