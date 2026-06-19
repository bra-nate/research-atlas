import { Router } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  grants,
  organizations,
  people,
  projectGrants,
  projectMembers,
  projectPartners,
  projectPublications,
  projects,
  publications,
} from "../db/schema.js";
import { asyncHandler, HttpError } from "../http.js";
import { parseLimit, prefixTsQuery, str } from "../lib/search.js";
import {
  toGrant,
  toOrganization,
  toPerson,
  toProject,
  toPublication,
} from "../serializers.js";

export const projectsRouter = Router();

/** GET /projects — search (q, programId, country). */
projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);
    const programId = str(req.query.programId);
    const country = str(req.query.country);

    const filters = [];
    const tsq = q ? prefixTsQuery(q) : null;
    if (tsq) filters.push(sql`search_fts @@ to_tsquery('english', ${tsq})`);
    if (programId) filters.push(eq(projects.programId, programId));
    if (country) filters.push(eq(projects.country, country));

    const sort = str(req.query.sort);
    const limit = parseLimit(req.query.limit);
    let qb = db
      .select()
      .from(projects)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(sort === "recent" ? desc(projects.ingestedAt) : projects.title)
      .$dynamic();
    if (limit) qb = qb.limit(limit);
    const rows = await qb;
    res.json(rows.map(toProject));
  }),
);

/** GET /projects/:id */
projectsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const [row] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, req.params.id))
      .limit(1);
    if (!row) throw new HttpError(404, "Project not found");
    res.json(toProject(row));
  }),
);

/** GET /projects/:id/members — people on this project (with role). */
projectsRouter.get(
  "/:id/members",
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({ person: people, role: projectMembers.role })
      .from(projectMembers)
      .innerJoin(people, eq(people.id, projectMembers.personId))
      .where(eq(projectMembers.projectId, req.params.id));
    res.json(rows.map((r) => ({ role: r.role, person: toPerson(r.person) })));
  }),
);

/** GET /projects/:id/partners — partner organisations on this project. */
projectsRouter.get(
  "/:id/partners",
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({ org: organizations, role: projectPartners.role })
      .from(projectPartners)
      .innerJoin(organizations, eq(organizations.id, projectPartners.orgId))
      .where(eq(projectPartners.projectId, req.params.id));
    res.json(rows.map((r) => ({ role: r.role, organization: toOrganization(r.org) })));
  }),
);

/** GET /projects/:id/publications — outputs linked to this project (newest first). */
projectsRouter.get(
  "/:id/publications",
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({ publication: publications })
      .from(projectPublications)
      .innerJoin(
        publications,
        eq(publications.id, projectPublications.publicationId),
      )
      .where(eq(projectPublications.projectId, req.params.id))
      .orderBy(desc(publications.publicationDate));
    res.json(rows.map((r) => ({ publication: toPublication(r.publication) })));
  }),
);

/** GET /projects/:id/grants — grants funding this project, with funder org. */
projectsRouter.get(
  "/:id/grants",
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({ grant: grants, funder: organizations })
      .from(projectGrants)
      .innerJoin(grants, eq(grants.id, projectGrants.grantId))
      .leftJoin(organizations, eq(organizations.id, grants.funderOrgId))
      .where(eq(projectGrants.projectId, req.params.id));
    res.json(
      rows.map((r) => ({
        grant: toGrant(r.grant),
        funder: r.funder ? toOrganization(r.funder) : null,
      })),
    );
  }),
);
