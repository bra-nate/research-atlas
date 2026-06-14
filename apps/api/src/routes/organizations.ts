import { Router } from "express";
import { and, arrayOverlaps, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { capabilities, organizations, people } from "../db/schema.js";
import { asyncHandler, HttpError } from "../http.js";
import { prefixTsQuery, str, uniqSorted } from "../lib/search.js";
import { toOrganization } from "../serializers.js";

/** Public, read-only organization endpoints (no auth in V1). */
export const organizationsRouter = Router();

/** GET /organizations — search/list (q, country, theme). */
organizationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);
    const country = str(req.query.country);
    const theme = str(req.query.theme);

    const filters = [];
    const tsq = q ? prefixTsQuery(q) : null;
    if (tsq) filters.push(sql`search_fts @@ to_tsquery('english', ${tsq})`);
    if (country) filters.push(eq(organizations.country, country));
    if (theme) filters.push(arrayOverlaps(organizations.thematicAreas, [theme]));

    const rows = await db
      .select()
      .from(organizations)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(organizations.name);
    res.json(rows.map(toOrganization));
  }),
);

/** GET /organizations/facets — distinct countries + themes. */
organizationsRouter.get(
  "/facets",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        country: organizations.country,
        thematicAreas: organizations.thematicAreas,
      })
      .from(organizations);
    res.json({
      countries: uniqSorted(rows.map((r) => r.country)),
      themes: uniqSorted(rows.flatMap((r) => r.thematicAreas ?? [])),
    });
  }),
);

/** GET /organizations/counts?ids=a,b,c — inventory tallies per organization. */
organizationsRouter.get(
  "/counts",
  asyncHandler(async (req, res) => {
    const ids = str(req.query.ids)?.split(",").filter(Boolean) ?? [];
    const counts: Record<string, { people: number; capabilities: number }> = {};
    for (const id of ids) counts[id] = { people: 0, capabilities: 0 };
    if (ids.length === 0) {
      res.json(counts);
      return;
    }
    const peopleRows = await db
      .select({ organizationId: people.organizationId })
      .from(people)
      .where(and(eq(people.visible, true), inArray(people.organizationId, ids)));
    const capRows = await db
      .select({ organizationId: capabilities.organizationId })
      .from(capabilities)
      .where(inArray(capabilities.organizationId, ids));
    for (const r of peopleRows) if (counts[r.organizationId]) counts[r.organizationId].people += 1;
    for (const r of capRows) if (counts[r.organizationId]) counts[r.organizationId].capabilities += 1;
    res.json(counts);
  }),
);

/** GET /organizations/:id — single organization profile. */
organizationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const [row] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, req.params.id))
      .limit(1);
    if (!row) throw new HttpError(404, "Organization not found");
    res.json(toOrganization(row));
  }),
);
