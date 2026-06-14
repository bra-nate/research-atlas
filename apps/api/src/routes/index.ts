import { Router } from "express";
import { organizationsRouter } from "./organizations.js";
import { peopleRouter } from "./people.js";
import { capabilitiesRouter } from "./capabilities.js";

/**
 * Public API surface. V1 is read-only and unauthenticated — discovery only.
 * (When V2 adds "claim your profile", auth middleware lands here.)
 */
export const api = Router();

api.use("/organizations", organizationsRouter);
api.use("/people", peopleRouter);
api.use("/capabilities", capabilitiesRouter);
