/**
 * @research-atlas/types — the shared data-model spec for ACE Connect.
 *
 * Self-contained on purpose: these three entities (Organization, Person,
 * Capability) and their enums are the SHAPE that the separate Research
 * Directory product will mirror in its own repo. To seed that repo, copy this
 * `src/` directory wholesale — there are no ACE-private imports here.
 *
 * What is intentionally NOT here: accounts, connection requests, outcomes,
 * meetings, grants — those are ACE-private collaboration tables and never enter
 * the shared model.
 */
export * from "./enums.js";
export * from "./labels.js";
export * from "./organizations.js";
export * from "./people.js";
export * from "./capabilities.js";
