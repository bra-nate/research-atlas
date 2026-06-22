const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Render an `ingested_at` ISO timestamp as a short "Updated 19 Jun 2026" label.
 * Returns null for missing or unparseable input so callers can omit the line.
 */
export function formatUpdated(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Updated ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Title-case a taxonomy value (field of study, specialisation, skill) for display
 * — e.g. "plant breeding" → "Plant Breeding". Source data arrives lower-cased; we
 * capitalise the first letter of each word while preserving any existing intra-word
 * casing so acronyms ("mRNA", "PCR") survive intact.
 */
export function formatField(value: string): string {
  return value
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
