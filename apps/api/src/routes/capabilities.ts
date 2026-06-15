import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { CAPABILITY_KIND_VALUES } from "@research-atlas/types";
import { db } from "../db/client.js";
import { capabilities } from "../db/schema.js";
import { asyncHandler, HttpError } from "../http.js";
import { prefixTsQuery, str, uniqSorted } from "../lib/search.js";
import { toCapability } from "../serializers.js";

export const capabilitiesRouter = Router();

/** GET /capabilities — search (q, organizationId, kind, category). */
capabilitiesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);
    const organizationId = str(req.query.organizationId);
    const kind = str(req.query.kind);
    const category = str(req.query.category);

    const filters = [];
    if (organizationId) filters.push(eq(capabilities.orgId, organizationId));
    if (kind && (CAPABILITY_KIND_VALUES as readonly string[]).includes(kind))
      filters.push(eq(capabilities.kind, kind as (typeof CAPABILITY_KIND_VALUES)[number]));
    if (category) filters.push(eq(capabilities.category, category));
    const tsq = q ? prefixTsQuery(q) : null;
    if (tsq) filters.push(sql`search_fts @@ to_tsquery('english', ${tsq})`);

    const rows = await db
      .select()
      .from(capabilities)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(capabilities.name);
    res.json(rows.map(toCapability));
  }),
);

/** GET /capabilities/facets — distinct categories. */
capabilitiesRouter.get(
  "/facets",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({ category: capabilities.category })
      .from(capabilities);
    res.json({ categories: uniqSorted(rows.map((r) => r.category)) });
  }),
);

/** GET /capabilities/:id */
capabilitiesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const [row] = await db
      .select()
      .from(capabilities)
      .where(eq(capabilities.id, req.params.id))
      .limit(1);
    if (!row) throw new HttpError(404, "Capability not found");
    res.json(toCapability(row));
  }),
);
