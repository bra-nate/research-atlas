import type { AuthorshipInput, PublicationUpsert } from "./types.js";

/** Strip an OpenAlex/ORCID/ROR URL down to its bare id. */
function bareId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.trim().split(/[?#]/)[0].replace(/\/+$/, "").split("/").pop();
  return m || null;
}

interface OAAuthorship {
  author_position?: string;
  author?: { id?: string | null; orcid?: string | null; display_name?: string | null };
  raw_author_name?: string | null;
  institutions?: { ror?: string | null }[];
}
interface OAWork {
  id?: string;
  doi?: string | null;
  title?: string | null;
  publication_date?: string | null;
  primary_location?: { landing_page_url?: string | null; source?: { display_name?: string | null } | null } | null;
  authorships?: OAAuthorship[];
}

/** One OpenAlex work → a normalised publication, or null if it has no title. */
export function normalizeWork(workRaw: unknown): PublicationUpsert | null {
  const w = workRaw as OAWork;
  const title = w.title?.trim();
  if (!title) return null;
  const loc = w.primary_location ?? null;
  return {
    title,
    doi: bareId(w.doi ?? null),
    openalexId: bareId(w.id ?? null),
    journal: loc?.source?.display_name ?? null,
    publicationDate: w.publication_date ?? null,
    url: loc?.landing_page_url ?? (w.doi ?? null),
    sourceUrl: w.id ?? "https://openalex.org",
  };
}

/** All authorships on a work, with 1-based positions and resolution keys. */
export function extractAuthorships(workRaw: unknown): AuthorshipInput[] {
  const w = workRaw as OAWork;
  return (w.authorships ?? []).map((a, i) => ({
    orcid: bareId(a.author?.orcid ?? null),
    openalexAuthorId: bareId(a.author?.id ?? null),
    rawName: (a.raw_author_name ?? a.author?.display_name ?? "").trim(),
    position: i + 1,
    instRor: bareId((a.institutions ?? []).map((x) => x.ror).find((r) => r != null) ?? null),
  }));
}
