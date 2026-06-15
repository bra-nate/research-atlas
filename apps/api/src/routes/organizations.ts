import { Router } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ORG_TYPE_VALUES } from "@research-atlas/types";
import { db } from "../db/client.js";
import { capabilities, organizations, people } from "../db/schema.js";
import { asyncHandler, HttpError } from "../http.js";
import { prefixTsQuery, str, uniqSorted } from "../lib/search.js";
import { toOrganization } from "../serializers.js";

export const organizationsRouter = Router();

/** GET /organizations — search/list (q, country, org_type). */
organizationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);
    const country = str(req.query.country);
    const orgType = str(req.query.org_type);

    const filters = [];
    const tsq = q ? prefixTsQuery(q) : null;
    if (tsq) filters.push(sql`search_fts @@ to_tsquery('english', ${tsq})`);
    if (country) filters.push(eq(organizations.country, country));
    if (orgType && (ORG_TYPE_VALUES as readonly string[]).includes(orgType))
      filters.push(eq(organizations.orgType, orgType as (typeof ORG_TYPE_VALUES)[number]));

    const rows = await db
      .select()
      .from(organizations)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(organizations.name);
    res.json(rows.map(toOrganization));
  }),
);

/** GET /organizations/facets — distinct countries + org types present. */
organizationsRouter.get(
  "/facets",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({ country: organizations.country, orgType: organizations.orgType })
      .from(organizations);
    res.json({
      countries: uniqSorted(rows.map((r) => r.country)),
      orgTypes: uniqSorted(rows.map((r) => r.orgType)),
    });
  }),
);

/** GET /organizations/counts?ids=a,b — people + capability tallies per org. */
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
      .select({ orgId: people.primaryOrgId })
      .from(people)
      .where(and(eq(people.visible, true), inArray(people.primaryOrgId, ids)));
    const capRows = await db
      .select({ orgId: capabilities.orgId })
      .from(capabilities)
      .where(inArray(capabilities.orgId, ids));
    for (const r of peopleRows) if (r.orgId && counts[r.orgId]) counts[r.orgId].people += 1;
    for (const r of capRows) if (counts[r.orgId]) counts[r.orgId].capabilities += 1;
    res.json(counts);
  }),
);

/** GET /organizations/:id */
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
