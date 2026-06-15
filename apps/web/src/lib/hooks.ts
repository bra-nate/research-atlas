import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/** Read-only React Query hooks over the public Directory API. */

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
}) {
  return useQuery({
    queryKey: ["people", filters],
    queryFn: () => api.people(filters),
  });
}

export function useCapabilitiesSearch(q: string) {
  return useQuery({
    queryKey: ["capabilities", "search", q],
    queryFn: () => api.capabilities({ q: q || undefined }),
  });
}
