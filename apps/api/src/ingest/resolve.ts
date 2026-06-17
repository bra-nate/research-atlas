export interface PersonCandidate {
  id: string;
  orcid: string | null;
  openalexAuthorId: string | null;
  normalisedName: string | null;
  primaryOrgId: string | null;
}

export interface MatchInput {
  orcid: string | null;
  openalexAuthorId: string | null;
  normalisedName: string;
  orgId: string | null;
}

/**
 * Decide which existing person an incoming person is, given candidate rows.
 * ORCID (1.0) > OpenAlex author id (0.95) > normalised name corroborated by a
 * shared primary org (0.7). Name-only with no org agreement is NOT a match.
 */
export function pickPersonMatch(
  input: MatchInput,
  candidates: PersonCandidate[],
): { personId: string; confidence: number } | null {
  if (input.orcid) {
    const hit = candidates.find((c) => c.orcid && c.orcid === input.orcid);
    if (hit) return { personId: hit.id, confidence: 1.0 };
  }
  if (input.openalexAuthorId) {
    const hit = candidates.find((c) => c.openalexAuthorId && c.openalexAuthorId === input.openalexAuthorId);
    if (hit) return { personId: hit.id, confidence: 0.95 };
  }
  if (input.orgId) {
    const hit = candidates.find(
      (c) => c.normalisedName === input.normalisedName && c.primaryOrgId && c.primaryOrgId === input.orgId,
    );
    if (hit) return { personId: hit.id, confidence: 0.7 };
  }
  return null;
}

/** Load plausible candidates from the DB and run the pure matcher. */
export async function matchPersonToExisting(
  input: MatchInput,
): Promise<{ personId: string; confidence: number } | null> {
  // Imported lazily so the pure pickPersonMatch (and its unit test) never pull
  // in the DB client / env validation at module load.
  const { or, eq } = await import("drizzle-orm");
  const { db } = await import("../db/client.js");
  const { people } = await import("../db/schema.js");

  const clauses = [eq(people.normalisedName, input.normalisedName)];
  if (input.orcid) clauses.push(eq(people.orcid, input.orcid));
  if (input.openalexAuthorId) clauses.push(eq(people.openalexAuthorId, input.openalexAuthorId));

  const rows = await db
    .select({
      id: people.id,
      orcid: people.orcid,
      openalexAuthorId: people.openalexAuthorId,
      normalisedName: people.normalisedName,
      primaryOrgId: people.primaryOrgId,
    })
    .from(people)
    .where(or(...clauses));

  return pickPersonMatch(input, rows);
}
