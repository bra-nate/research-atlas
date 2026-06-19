import { Router } from "express";
import { and, arrayOverlaps, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  projectMembers,
  projects,
  people,
  publicationAuthors,
  publications,
} from "../db/schema.js";
import { asyncHandler, HttpError } from "../http.js";
import { prefixTsQuery, str, uniqSorted } from "../lib/search.js";
import { toPerson, toProject, toPublication } from "../serializers.js";

export const peopleRouter = Router();

/** GET /people — search (q, specialization, organizationId). */
peopleRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);
    const specialization = str(req.query.specialization);
    const organizationId = str(req.query.organizationId);

    const filters = [eq(people.visible, true)];
    if (organizationId) filters.push(eq(people.primaryOrgId, organizationId));
    const tsq = q ? prefixTsQuery(q) : null;
    if (tsq) filters.push(sql`search_fts @@ to_tsquery('english', ${tsq})`);
    if (specialization)
      filters.push(arrayOverlaps(people.specializations, [specialization]));

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

/** GET /people/:id */
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

/**
 * GET /people/:id/projects — the hero feature: every project (and role) this
 * person is on, across all programmes/consortia. Joins through project_members.
 */
peopleRouter.get(
  "/:id/projects",
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({ project: projects, role: projectMembers.role })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(eq(projectMembers.personId, req.params.id));
    res.json(rows.map((r) => ({ role: r.role, project: toProject(r.project) })));
  }),
);

/**
 * GET /people/:id/publications — this person's outputs (newest first). Joins
 * through publication_authors and carries author_position.
 */
peopleRouter.get(
  "/:id/publications",
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({
        publication: publications,
        position: publicationAuthors.authorPosition,
        matchConfidence: publicationAuthors.matchConfidence,
      })
      .from(publicationAuthors)
      .innerJoin(
        publications,
        eq(publications.id, publicationAuthors.publicationId),
      )
      .where(eq(publicationAuthors.personId, req.params.id))
      .orderBy(desc(publications.publicationDate));
    res.json(
      rows.map((r) => ({
        author_position: r.position,
        match_confidence: r.matchConfidence != null ? Number(r.matchConfidence) : null,
        publication: toPublication(r.publication),
      })),
    );
  }),
);
