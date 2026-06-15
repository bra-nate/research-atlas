import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { people, publicationAuthors, publications } from "../db/schema.js";
import { asyncHandler, HttpError } from "../http.js";
import { prefixTsQuery, str } from "../lib/search.js";
import { toPerson, toPublication } from "../serializers.js";

export const publicationsRouter = Router();

/** GET /publications — search (q). */
publicationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);
    const filters = [];
    const tsq = q ? prefixTsQuery(q) : null;
    if (tsq) filters.push(sql`search_fts @@ to_tsquery('english', ${tsq})`);
    const rows = await db
      .select()
      .from(publications)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(publications.title);
    res.json(rows.map(toPublication));
  }),
);

/** GET /publications/:id */
publicationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const [row] = await db
      .select()
      .from(publications)
      .where(eq(publications.id, req.params.id))
      .limit(1);
    if (!row) throw new HttpError(404, "Publication not found");
    res.json(toPublication(row));
  }),
);

/** GET /publications/:id/authors — people who authored this publication. */
publicationsRouter.get(
  "/:id/authors",
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({ person: people, position: publicationAuthors.authorPosition })
      .from(publicationAuthors)
      .innerJoin(people, eq(people.id, publicationAuthors.personId))
      .where(eq(publicationAuthors.publicationId, req.params.id));
    res.json(
      rows.map((r) => ({ author_position: r.position, person: toPerson(r.person) })),
    );
  }),
);
