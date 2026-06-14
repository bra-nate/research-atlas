import { Router } from "express";
import { and, arrayOverlaps, eq, sql } from "drizzle-orm";
import { AVAILABILITY_BASIS_VALUES } from "@research-atlas/types";
import { db } from "../db/client.js";
import { people } from "../db/schema.js";
import { asyncHandler, HttpError } from "../http.js";
import { prefixTsQuery, str, uniqSorted } from "../lib/search.js";
import { toPerson } from "../serializers.js";

/** Public, read-only people endpoints (no auth, no contact data in V1). */
export const peopleRouter = Router();

/** GET /people — search (q, specialization, basis, organizationId). */
peopleRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);
    const specialization = str(req.query.specialization);
    const basis = str(req.query.basis);
    const organizationId = str(req.query.organizationId);

    const filters = [eq(people.visible, true)];
    if (organizationId) filters.push(eq(people.organizationId, organizationId));
    const tsq = q ? prefixTsQuery(q) : null;
    if (tsq) filters.push(sql`search_fts @@ to_tsquery('english', ${tsq})`);
    if (specialization)
      filters.push(arrayOverlaps(people.specializations, [specialization]));
    if (basis && (AVAILABILITY_BASIS_VALUES as readonly string[]).includes(basis))
      filters.push(
        arrayOverlaps(people.availabilityBasis, [
          basis as (typeof AVAILABILITY_BASIS_VALUES)[number],
        ]),
      );

    const rows = await db
      .select()
      .from(people)
      .where(and(...filters))
      .orderBy(people.fullName);
    res.json(rows.map(toPerson));
  }),
);

/** GET /people/facets — distinct specializations + skills. */
peopleRouter.get(
  "/facets",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({ specializations: people.specializations, skills: people.skills })
      .from(people);
    res.json({
      specializations: uniqSorted(
        rows.flatMap((r) => [...(r.specializations ?? []), ...(r.skills ?? [])]),
      ),
    });
  }),
);

/** GET /people/:id — single person profile. */
peopleRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const [row] = await db
      .select()
      .from(people)
      .where(eq(people.id, req.params.id))
      .limit(1);
    if (!row) throw new HttpError(404, "Person not found");
    res.json(toPerson(row));
  }),
);
