import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
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
  EntityLink,
  IllustrativeBadge,
  Input,
  MonoCode,
  Tag,
} from "../components/ui";
import { cn } from "../lib/cn";

type Tab = "organizations" | "people" | "capabilities";

const TABS: { id: Tab; label: string }[] = [
  { id: "organizations", label: "Organisations" },
  { id: "people", label: "People" },
  { id: "capabilities", label: "Capabilities" },
];

const isTab = (v: string | null): v is Tab =>
  v === "organizations" || v === "people" || v === "capabilities";

export function DirectoryPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "organizations";
  const q = params.get("q") ?? "";
  const [country, setCountry] = useState("");
  const [orgType, setOrgType] = useState("");

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    next.set("tab", t);
    setParams(next, { replace: true });
  };
  const setQ = (v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set("q", v);
    else next.delete("q");
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">
          Research Atlas
        </h1>
        <p className="text-sm text-ink-secondary">
          Discover organisations, people, and capabilities across the African
          research ecosystem. Aggregated from public sources.
        </p>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-brand text-brand"
                : "border-transparent text-ink-secondary hover:text-ink",
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
    "rounded-lg border border-border bg-white px-2.5 py-2 text-sm text-ink";
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
          <Card key={o.id} className="p-4 transition-shadow hover:shadow-[0_1px_4px_rgba(16,24,40,.08)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <EntityLink to={`/organizations/${o.id}`} className="text-[15px]">
                  {o.name}
                </EntityLink>
                <div className="mt-1 flex items-center gap-2">
                  {o.short_name && <MonoCode>{o.short_name}</MonoCode>}
                  {o.country && (
                    <span className="text-xs text-ink-secondary">{o.country}</span>
                  )}
                </div>
              </div>
              <IllustrativeBadge status={o.verification_status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Tag>{ORG_TYPE_LABELS[o.org_type] ?? o.org_type}</Tag>
              <span className="text-xs text-ink-secondary">
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
        <Card key={p.id} className="p-4 transition-shadow hover:shadow-[0_1px_4px_rgba(16,24,40,.08)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <EntityLink to={`/people/${p.id}`} className="text-[15px]">
                {p.full_name}
              </EntityLink>
              <div className="text-xs text-ink-secondary">
                {[p.title, p.highest_qualification].filter(Boolean).join(" · ")}
              </div>
            </div>
            <IllustrativeBadge status={p.verification_status} />
          </div>
          {p.specializations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {p.specializations.slice(0, 4).map((s) => (
                <Tag key={s}>{s}</Tag>
              ))}
            </div>
          )}
          {p.bio && (
            <p className="mt-2 line-clamp-2 text-sm text-ink-secondary">{p.bio}</p>
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
        <Card key={c.id} className="p-4 transition-shadow hover:shadow-[0_1px_4px_rgba(16,24,40,.08)]">
          <div className="flex items-center justify-between gap-2">
            <EntityLink to={`/capabilities/${c.id}`} className="text-[15px]">
              {c.name}
            </EntityLink>
            <Tag>{CAPABILITY_KIND_LABELS[c.kind]}</Tag>
          </div>
          {(c.category || c.city || c.country) && (
            <div className="text-xs text-ink-secondary">
              {[c.category, c.city, c.country].filter(Boolean).join(" · ")}
            </div>
          )}
          {c.description && (
            <p className="mt-2 line-clamp-2 text-sm text-ink-secondary">{c.description}</p>
          )}
        </Card>
      ))}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Card className="p-8 text-center text-sm text-ink-secondary">{children}</Card>
  );
}
