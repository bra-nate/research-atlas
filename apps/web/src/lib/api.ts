import type { Capability, Organization, Person } from "@research-atlas/types";

export type ApiError = { status: number; message: string };

export type CentreCounts = Record<
  string,
  { people: number; capabilities: number }
>;

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
  organizations: (p?: { q?: string; country?: string; org_type?: string }) =>
    req<Organization[]>(`/organizations${qs(p)}`),
  organization: (id: string) => req<Organization>(`/organizations/${id}`),
  organizationFacets: () =>
    req<{ countries: string[]; orgTypes: string[] }>("/organizations/facets"),
  centreCounts: (ids: string[]) =>
    req<CentreCounts>(`/organizations/counts${qs({ ids: ids.join(",") })}`),

  people: (p?: { q?: string; specialization?: string; organizationId?: string }) =>
    req<Person[]>(`/people${qs(p)}`),
  person: (id: string) => req<Person>(`/people/${id}`),
  peopleFacets: () => req<{ specializations: string[] }>("/people/facets"),

  capabilities: (p?: { q?: string; organizationId?: string; kind?: string }) =>
    req<Capability[]>(`/capabilities${qs(p)}`),
};
