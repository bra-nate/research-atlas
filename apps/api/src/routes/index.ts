import { Router } from "express";
import { organizationsRouter } from "./organizations.js";
import { peopleRouter } from "./people.js";
import { capabilitiesRouter } from "./capabilities.js";
import { programsRouter } from "./programs.js";
import { projectsRouter } from "./projects.js";
import { grantsRouter } from "./grants.js";
import { publicationsRouter } from "./publications.js";
import { statsRouter } from "./stats.js";

/**
 * Public API surface. V1 is read-only and unauthenticated — discovery only.
 * (When V2 adds "claim your profile", auth middleware lands here.)
 */
export const api = Router();

api.use("/organizations", organizationsRouter);
api.use("/people", peopleRouter);
api.use("/capabilities", capabilitiesRouter);
api.use("/programs", programsRouter);
api.use("/projects", projectsRouter);
api.use("/grants", grantsRouter);
api.use("/publications", publicationsRouter);
api.use("/stats", statsRouter);
