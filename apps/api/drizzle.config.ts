import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config. The canonical schema lives in supabase/migrations (hand-
 * authored SQL incl. RLS); this is here for type-aware introspection/diffing
 * during development, not as the migration source of truth.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
