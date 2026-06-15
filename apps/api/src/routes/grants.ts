import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { grants } from "../db/schema.js";
import { asyncHandler, HttpError } from "../http.js";
import { str } from "../lib/search.js";
import { toGrant } from "../serializers.js";

export const grantsRouter = Router();

/** GET /grants — list (funderOrgId). */
grantsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const funderOrgId = str(req.query.funderOrgId);
    const filters = [];
    if (funderOrgId) filters.push(eq(grants.funderOrgId, funderOrgId));
    const rows = await db
      .select()
      .from(grants)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(grants.name);
    res.json(rows.map(toGrant));
  }),
);

/** GET /grants/:id */
grantsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const [row] = await db
      .select()
      .from(grants)
      .where(eq(grants.id, req.params.id))
      .limit(1);
    if (!row) throw new HttpError(404, "Grant not found");
    res.json(toGrant(row));
  }),
);
