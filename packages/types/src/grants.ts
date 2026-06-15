/** Grant — a funding award (funding intelligence). funder_org_id → an org of type 'funder'. */
import type { Provenance } from "./provenance.js";

export interface Grant extends Provenance {
  id: string;
  name: string;
  funder_org_id: string | null;
  award_number: string | null;
  amount: number | null;
  currency: string | null;
  start_date: string | null; // ISO date
  end_date: string | null; // ISO date
  description: string | null;
}
