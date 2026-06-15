/** Capability — equipment / facility / service at an organisation (descriptive only). */
import type { CapabilityKind } from "./enums.js";
import type { Provenance } from "./provenance.js";

export interface Capability extends Provenance {
  id: string;
  org_id: string;
  kind: CapabilityKind;
  name: string;
  category: string | null;
  description: string | null;
  access_note: string | null; // free text — no booking/availability engine
  country: string | null;
  city: string | null;
}
