import { useMemo, useState, type ReactNode } from "react";
import {
  CAPABILITY_KIND_LABELS,
  ORG_TYPE_LABELS,
  type OrgType,
} from "@research-atlas/types";
import {
  useCapabilitiesSearch,
  useCentreCounts,
  useOrganizationFacets,
  useOrganizations,
  usePeople,
} from "../lib/hooks";
import {
  Card,
  IllustrativeBadge,
  Input,
  MonoCode,
  StatusPill,
} from "../components/ui";
import { cn } from "../lib/cn";

type Tab = "organizations" | "people" | "capabilities";

const TABS: { id: Tab; label: string }[] = [
  { id: "organizations", label: "Organisations" },
  { id: "people", label: "People" },
  { id: "capabilities", label: "Capabilities" },
];

export function DirectoryPage() {
  const [tab, setTab] = useState<Tab>("organizations");
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [orgType, setOrgType] = useState("");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Research Atlas</h1>
        <p className="text-sm text-gray-500">
          Discover organisations, people, and capabilities across the African
          research ecosystem. Aggregated from public sources.
        </p>
      </div>

      <div className="flex items-center gap-1 border-b border-hairline">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-brand text-brand"
                : "border-transparent text-gray-500 hover:text-gray-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="max-w-xs"
        />
        {tab === "organizations" && (
          <OrgFacetFilters
            country={country}
            orgType={orgType}
            onCountry={setCountry}
            onOrgType={setOrgType}
          />
        )}
      </div>

      {tab === "organizations" && (
        <OrganizationsList q={q} country={country} orgType={orgType} />
      )}
      {tab === "people" && <PeopleList q={q} />}
      {tab === "capabilities" && <CapabilitiesList q={q} />}
    </div>
  );
}

function OrgFacetFilters({
  country,
  orgType,
  onCountry,
  onOrgType,
}: {
  country: string;
  orgType: string;
  onCountry: (v: string) => void;
  onOrgType: (v: string) => void;
}) {
  const facets = useOrganizationFacets();
  const sel =
    "rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm text-gray-700";
  return (
    <>
      <select className={sel} value={country} onChange={(e) => onCountry(e.target.value)}>
        <option value="">All countries</option>
        {facets.data?.countries.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <select className={sel} value={orgType} onChange={(e) => onOrgType(e.target.value)}>
        <option value="">All types</option>
        {facets.data?.orgTypes.map((t) => (
          <option key={t} value={t}>
            {ORG_TYPE_LABELS[t as OrgType] ?? t}
          </option>
        ))}
      </select>
    </>
  );
}

function OrganizationsList({
  q,
  country,
  orgType,
}: {
  q: string;
  country: string;
  orgType: string;
}) {
  const orgs = useOrganizations({ q, country, org_type: orgType });
  const ids = useMemo(() => (orgs.data ?? []).map((o) => o.id), [orgs.data]);
  const counts = useCentreCounts(ids);

  if (orgs.isLoading) return <Empty>Loading organisations…</Empty>;
  if (!orgs.data?.length) return <Empty>No organisations match your search.</Empty>;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {orgs.data.map((o) => {
        const c = counts.data?.[o.id];
        return (
          <Card key={o.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-medium text-gray-900">{o.name}</span>
                <div className="mt-1 flex items-center gap-2">
                  {o.short_name && <MonoCode>{o.short_name}</MonoCode>}
                  {o.country && (
                    <span className="text-xs text-gray-500">{o.country}</span>
                  )}
                </div>
              </div>
              <IllustrativeBadge status={o.verification_status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill tone="blue">
                {ORG_TYPE_LABELS[o.org_type] ?? o.org_type}
              </StatusPill>
              <span className="text-xs text-gray-500">
                {c?.people ?? "—"} people · {c?.capabilities ?? "—"} capabilities
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function PeopleList({ q }: { q: string }) {
  const people = usePeople({ q });
  if (people.isLoading) return <Empty>Loading people…</Empty>;
  if (!people.data?.length) return <Empty>No people match your search.</Empty>;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {people.data.map((p) => (
        <Card key={p.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium text-gray-900">{p.full_name}</div>
              <div className="text-xs text-gray-500">
                {[p.title, p.highest_qualification].filter(Boolean).join(" · ")}
              </div>
            </div>
            <IllustrativeBadge status={p.verification_status} />
          </div>
          {p.specializations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {p.specializations.slice(0, 4).map((s) => (
                <StatusPill key={s} tone="gray">
                  {s}
                </StatusPill>
              ))}
            </div>
          )}
          {p.bio && (
            <p className="mt-2 line-clamp-2 text-sm text-gray-600">{p.bio}</p>
          )}
        </Card>
      ))}
    </div>
  );
}

function CapabilitiesList({ q }: { q: string }) {
  const caps = useCapabilitiesSearch(q);
  if (caps.isLoading) return <Empty>Loading capabilities…</Empty>;
  if (!caps.data?.length)
    return <Empty>No capabilities match your search.</Empty>;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {caps.data.map((c) => (
        <Card key={c.id} className="p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900">{c.name}</span>
            <StatusPill tone="blue">{CAPABILITY_KIND_LABELS[c.kind]}</StatusPill>
          </div>
          {(c.category || c.city || c.country) && (
            <div className="text-xs text-gray-500">
              {[c.category, c.city, c.country].filter(Boolean).join(" · ")}
            </div>
          )}
          {c.description && (
            <p className="mt-2 line-clamp-2 text-sm text-gray-600">{c.description}</p>
          )}
        </Card>
      ))}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Card className="p-8 text-center text-sm text-gray-500">{children}</Card>
  );
}
