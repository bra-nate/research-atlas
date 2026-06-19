/**
 * @research-atlas/types — the Research Directory's shared data-model spec.
 *
 * Entities: organizations, people, capabilities, programs, projects, grants,
 * publications. Edges: project_members, project_partners, publication_authors.
 * Every entity/edge carries Provenance. Mirrors DATA.md; keep in sync with the
 * migrations. Imported by both the API and the web SPA.
 */
export * from "./enums.js";
export * from "./provenance.js";
export * from "./labels.js";
export * from "./organizations.js";
export * from "./people.js";
export * from "./capabilities.js";
export * from "./programs.js";
export * from "./projects.js";
export * from "./grants.js";
export * from "./publications.js";
export * from "./edges.js";
export * from "./stats.js";
