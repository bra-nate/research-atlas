/** Program — a funding programme / consortium umbrella (e.g. H3Africa, DELTAS). */
import type { Provenance } from "./provenance.js";

export interface Program extends Provenance {
  id: string;
  name: string;
  short_name: string | null;
  funders: string[];
  focus_areas: string[];
  region: string | null;
  website: string | null;
  description: string | null;
  logo_url: string | null;
}
