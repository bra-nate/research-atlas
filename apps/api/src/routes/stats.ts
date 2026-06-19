import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  capabilities,
  grants,
  organizations,
  people,
  programs,
  projects,
  publications,
} from "../db/schema.js";
import { asyncHandler } from "../http.js";

export const statsRouter = Router();

/** GET /stats — total counts per entity type (visible rows) for the landing banner. */
statsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const count = async (table: Parameters<typeof db.select>[0] extends never ? never : any, where?: unknown) => {
      const q = db.select({ n: sql<number>`count(*)::int` }).from(table);
      const [row] = where ? await (q as any).where(where) : await q;
      return row?.n ?? 0;
    };
    const [programmes, projectsN, organizationsN, peopleN, capabilitiesN, publicationsN, grantsN] =
      await Promise.all([
        count(programs),
        count(projects),
        count(organizations),
        count(people, eq(people.visible, true)),
        count(capabilities),
        count(publications),
        count(grants),
      ]);
    res.json({
      programmes,
      projects: projectsN,
      organizations: organizationsN,
      people: peopleN,
      capabilities: capabilitiesN,
      publications: publicationsN,
      grants: grantsN,
    });
  }),
);
