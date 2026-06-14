import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.js";
import * as schema from "./schema.js";

/**
 * Single server-side Postgres connection for the whole API. This is the ONLY
 * place that talks to the database — the SPA never connects directly. Uses a
 * privileged connection (Supabase Postgres role / service connection string),
 * so RLS is not the primary guard here: the API's auth + centre-scoping
 * middleware is. RLS remains enabled in the DB as defense-in-depth.
 */
const queryClient = postgres(env.databaseUrl, { prepare: false });

export const db = drizzle(queryClient, { schema });
export { schema };
