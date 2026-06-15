import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { programs, projects } from "../db/schema.js";
import { asyncHandler, HttpError } from "../http.js";
import { toProgram, toProject } from "../serializers.js";

export const programsRouter = Router();

/** GET /programs — list all funding programmes / consortia. */
programsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(programs).orderBy(programs.name);
    res.json(rows.map(toProgram));
  }),
);

/** GET /programs/:id */
programsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const [row] = await db
      .select()
      .from(programs)
      .where(eq(programs.id, req.params.id))
      .limit(1);
    if (!row) throw new HttpError(404, "Program not found");
    res.json(toProgram(row));
  }),
);

/** GET /programs/:id/projects — projects under this programme. */
programsRouter.get(
  "/:id/projects",
  asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.programId, req.params.id))
      .orderBy(projects.title);
    res.json(rows.map(toProject));
  }),
);
