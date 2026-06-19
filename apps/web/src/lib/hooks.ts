import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/** Read-only React Query hooks over the public Directory API. */

// ── Lists / search ────────────────────────────────────────────────────────

export function useOrganizations(filters: {
  q?: string;
  country?: string;
  org_type?: string;
}) {
  return useQuery({
    queryKey: ["organizations", filters],
    queryFn: () => api.organizations(filters),
  });
}

export function useOrganizationFacets() {
  return useQuery({
    queryKey: ["organizationFacets"],
    queryFn: () => api.organizationFacets(),
  });
}

export function useCentreCounts(ids: string[]) {
  return useQuery({
    queryKey: ["centreCounts", ids],
    queryFn: () => api.centreCounts(ids),
    enabled: ids.length > 0,
  });
}

export function usePeople(filters: {
  q?: string;
  specialization?: string;
  organizationId?: string;
  sort?: string;
  limit?: string;
}) {
  return useQuery({
    queryKey: ["people", filters],
    queryFn: () => api.people(filters),
  });
}

export function useStats() {
  return useQuery({ queryKey: ["stats"], queryFn: () => api.stats() });
}

export function usePeopleFeatured(limit = 6) {
  return useQuery({
    queryKey: ["peopleFeatured", limit],
    queryFn: () => api.peopleFeatured(limit),
  });
}

export function useCapabilitiesSearch(q: string, category?: string) {
  return useQuery({
    queryKey: ["capabilities", "search", q, category],
    queryFn: () => api.capabilities({ q: q || undefined, category: category || undefined }),
  });
}

export function usePeopleFacets() {
  return useQuery({ queryKey: ["peopleFacets"], queryFn: () => api.peopleFacets() });
}

export function useCapabilityFacets() {
  return useQuery({ queryKey: ["capabilityFacets"], queryFn: () => api.capabilityFacets() });
}

export function usePrograms(params?: { sort?: string; limit?: string }) {
  return useQuery({ queryKey: ["programs", params], queryFn: () => api.programs(params) });
}

export function useProjects(filters: { q?: string; programId?: string; country?: string; sort?: string; limit?: string } = {}) {
  return useQuery({ queryKey: ["projects", filters], queryFn: () => api.projects(filters) });
}

export function usePublicationsSearch(q: string) {
  return useQuery({
    queryKey: ["publications", "search", q],
    queryFn: () => api.publications({ q: q || undefined }),
  });
}

// ── Detail / profiles ───────────────────────────────────────────────────────

export function useOrganization(id: string | undefined) {
  return useQuery({
    queryKey: ["organization", id],
    queryFn: () => api.organization(id!),
    enabled: !!id,
  });
}

export function useOrgPeople(id: string | undefined) {
  return useQuery({
    queryKey: ["people", { organizationId: id }],
    queryFn: () => api.people({ organizationId: id! }),
    enabled: !!id,
  });
}

export function useOrgCapabilities(id: string | undefined) {
  return useQuery({
    queryKey: ["capabilities", { organizationId: id }],
    queryFn: () => api.capabilities({ organizationId: id! }),
    enabled: !!id,
  });
}

export function usePerson(id: string | undefined) {
  return useQuery({
    queryKey: ["person", id],
    queryFn: () => api.person(id!),
    enabled: !!id,
  });
}

export function usePersonProjects(id: string | undefined) {
  return useQuery({
    queryKey: ["person", id, "projects"],
    queryFn: () => api.personProjects(id!),
    enabled: !!id,
  });
}

export function usePersonPublications(id: string | undefined) {
  return useQuery({
    queryKey: ["person", id, "publications"],
    queryFn: () => api.personPublications(id!),
    enabled: !!id,
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => api.project(id!),
    enabled: !!id,
  });
}

export function useProjectMembers(id: string | undefined) {
  return useQuery({
    queryKey: ["project", id, "members"],
    queryFn: () => api.projectMembers(id!),
    enabled: !!id,
  });
}

export function useProjectPartners(id: string | undefined) {
  return useQuery({
    queryKey: ["project", id, "partners"],
    queryFn: () => api.projectPartners(id!),
    enabled: !!id,
  });
}

export function useProjectPublications(id: string | undefined) {
  return useQuery({
    queryKey: ["project", id, "publications"],
    queryFn: () => api.projectPublications(id!),
    enabled: !!id,
  });
}

export function useProjectGrants(id: string | undefined) {
  return useQuery({
    queryKey: ["project", id, "grants"],
    queryFn: () => api.projectGrants(id!),
    enabled: !!id,
  });
}

export function useProgram(id: string | undefined) {
  return useQuery({
    queryKey: ["program", id],
    queryFn: () => api.program(id!),
    enabled: !!id,
  });
}

export function useProgramProjects(id: string | undefined) {
  return useQuery({
    queryKey: ["program", id, "projects"],
    queryFn: () => api.programProjects(id!),
    enabled: !!id,
  });
}

export function useCapability(id: string | undefined) {
  return useQuery({
    queryKey: ["capability", id],
    queryFn: () => api.capability(id!),
    enabled: !!id,
  });
}

export function usePublication(id: string | undefined) {
  return useQuery({
    queryKey: ["publication", id],
    queryFn: () => api.publication(id!),
    enabled: !!id,
  });
}

export function usePublicationAuthors(id: string | undefined) {
  return useQuery({
    queryKey: ["publication", id, "authors"],
    queryFn: () => api.publicationAuthors(id!),
    enabled: !!id,
  });
}

export function useGrant(id: string | undefined) {
  return useQuery({
    queryKey: ["grant", id],
    queryFn: () => api.grant(id!),
    enabled: !!id,
  });
}
