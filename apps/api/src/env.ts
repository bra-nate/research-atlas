import "dotenv/config";

/** Required env var or a thrown startup error (fail fast, never silently). */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Research Directory API config. Public + read-only in V1 — no auth, no JWT.
 * The only secret is the Postgres connection; the browser never sees it.
 */
export const env = {
  databaseUrl: required("DATABASE_URL"),
  port: Number(process.env.PORT ?? 4000),
  webOrigins: (process.env.WEB_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  openalexMailto: process.env.OPENALEX_MAILTO ?? "",
} as const;
