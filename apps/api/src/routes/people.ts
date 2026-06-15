import { Router } from "express";
import { and, arrayOverlaps, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { projectMembers, projects, people } from "../db/schema.js";
import { asyncHandler, HttpError } from "../http.js";
import { prefixTsQuery, str, uniqSorted } from "../lib/search.js";
import { toPerson, toProject } from "../serializers.js";

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
