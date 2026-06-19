import type {
  Capability,
  Grant,
  Organization,
  Person,
  Program,
  Project,
  Publication,
} from "@research-atlas/types";

export type ApiError = { status: number; message: string };

export type CentreCounts = Record<
  string,
  { people: number; capabilities: number }
>;

/** Edge-shaped responses the API returns for graph traversals. */
export type PersonProject = { role: string | null; project: Project };
export type PersonPublication = {
  author_position: number | null;
  match_confidence: number | null;
  publication: Publication;
};
export type ProjectMemberView = { role: string | null; person: Person };
export type ProjectPartnerView = { role: string | null; organization: Organization };
export type ProjectPublicationView = { publication: Publication };
export type ProjectGrantView = { grant: Grant; funder: Organization | null };
export type PublicationAuthorView = {
  author_position: number | null;
  person: Person;
};

function qs(params?: Record<string, string | undefined>): string {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) usp.set(k, v);
  const s = usp.toString();
  return s ? `?${s}` : "";
}

async function req<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw {
      status: res.status,
      message: (data as { error?: string })?.error ?? res.statusText,
    } satisfies ApiError;
  }
  return data as T;
}

/**
 * The Directory's data door. Read-only and unauthenticated (V1) — the browser
 * only ever calls the Express API, never the database.
 */
export const api = {
  // Organisations
  organizations: (p?: { q?: string; country?: string; org_type?: string }) =>
    req<Organization[]>(`/organizations${qs(p)}`),
  organization: (id: string) => req<Organization>(`/organizations/${id}`),
  organizationFacets: () =>
    req<{ countries: string[]; orgTypes: string[] }>("/organizations/facets"),
  centreCounts: (ids: string[]) =>
    req<CentreCounts>(`/organizations/counts${qs({ ids: ids.join(",") })}`),

  // People
  people: (p?: { q?: string; specialization?: string; organizationId?: string }) =>
    req<Person[]>(`/people${qs(p)}`),
  person: (id: string) => req<Person>(`/people/${id}`),
  personProjects: (id: string) => req<PersonProject[]>(`/people/${id}/projects`),
  personPublications: (id: string) =>
    req<PersonPublication[]>(`/people/${id}/publications`),
  peopleFacets: () => req<{ specializations: string[] }>("/people/facets"),

  // Projects / consortia
  projects: (p?: { q?: string; programId?: string; country?: string }) =>
    req<Project[]>(`/projects${qs(p)}`),
  project: (id: string) => req<Project>(`/projects/${id}`),
  projectMembers: (id: string) => req<ProjectMemberView[]>(`/projects/${id}/members`),
  projectPartners: (id: string) =>
    req<ProjectPartnerView[]>(`/projects/${id}/partners`),
  projectPublications: (id: string) =>
    req<ProjectPublicationView[]>(`/projects/${id}/publications`),
  projectGrants: (id: string) =>
    req<ProjectGrantView[]>(`/projects/${id}/grants`),

  // Programmes
  programs: () => req<Program[]>("/programs"),
  program: (id: string) => req<Program>(`/programs/${id}`),
  programProjects: (id: string) => req<Project[]>(`/programs/${id}/projects`),

  // Capabilities
  capabilities: (p?: { q?: string; organizationId?: string; kind?: string }) =>
    req<Capability[]>(`/capabilities${qs(p)}`),
  capability: (id: string) => req<Capability>(`/capabilities/${id}`),

  // Publications
  publication: (id: string) => req<Publication>(`/publications/${id}`),
  publicationAuthors: (id: string) =>
    req<PublicationAuthorView[]>(`/publications/${id}/authors`),

  // Grants
  grant: (id: string) => req<Grant>(`/grants/${id}`),
};
