import { useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import {
  usePeopleFeatured,
  useProjects,
  useStats,
} from "../lib/hooks";
import type { StatsResponse } from "@research-atlas/types";
import {
  Card,
  ConsortiaChip,
  EntityLink,
  IllustrativeBadge,
  Skeleton,
  SkeletonRows,
  Tag,
} from "../components/ui";

const SCOPES = [
  { value: "all", label: "All" },
  { value: "programmes", label: "Programmes" },
  { value: "projects", label: "Projects" },
  { value: "organizations", label: "Organisations" },
  { value: "people", label: "People" },
  { value: "capabilities", label: "Capabilities" },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("all");

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (scope !== "all") params.set("tab", scope);
    if (q.trim()) params.set("q", q.trim());
    const s = params.toString();
    navigate(`/directory${s ? `?${s}` : ""}`);
  }

  return (
    <div className="space-y-10">
      <Hero q={q} setQ={setQ} scope={scope} setScope={setScope} onSearch={onSearch} />
      <StatsBanner />
      <FeaturedPeople />
      <RecentlyAdded />
      <BrowseTiles />
      <LandingFooter />
    </div>
  );
}

function Hero({
  q,
  setQ,
  scope,
  setScope,
  onSearch,
}: {
  q: string;
  setQ: (v: string) => void;
  scope: string;
  setScope: (v: string) => void;
  onSearch: (e: FormEvent) => void;
}) {
  return (
    <section className="py-8 sm:py-12">
      <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        The map of the African research ecosystem
      </h1>
      <p className="mt-3 max-w-2xl text-base text-ink-secondary">
        Discover programmes, consortia, organisations, the people behind them, their
        funding and their publications — aggregated from public sources, free to browse.
      </p>
      <form onSubmit={onSearch} className="mt-6 max-w-2xl">
        <div
          role="radiogroup"
          aria-label="Search scope"
          className="mb-2 flex flex-wrap gap-1"
        >
          {SCOPES.map((s) => (
            <button
              type="button"
              key={s.value}
              role="radio"
              aria-checked={scope === s.value}
              onClick={() => setScope(s.value)}
              className={
                "rounded-full px-3 py-1 text-sm " +
                (scope === s.value
                  ? "bg-brand text-white"
                  : "bg-tag-bg text-ink-secondary hover:text-ink")
              }
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search the directory"
            placeholder="Search organisations, people, programmes…"
            className="flex-1 rounded-lg border border-border bg-white px-4 py-3 text-base text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Search
          </button>
        </div>
      </form>
    </section>
  );
}

function StatsBanner() {
  const stats = useStats();
  const items: { label: string; key: keyof StatsResponse }[] = [
    { label: "People", key: "people" },
    { label: "Programmes", key: "programmes" },
    { label: "Projects", key: "projects" },
    { label: "Organisations", key: "organizations" },
    { label: "Publications", key: "publications" },
  ];
  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-5">
      {items.map((it) => (
        <div key={it.key} className="bg-white px-4 py-4 text-center">
          <div className="text-2xl font-semibold tabular-nums text-ink">
            {stats.data ? (stats.data[it.key] as number).toLocaleString() : <Skeleton className="mx-auto h-7 w-16" />}
          </div>
          <div className="mt-1 text-xs text-ink-secondary">{it.label}</div>
        </div>
      ))}
    </section>
  );
}

function SectionHeading({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
      {href && (
        <EntityLink to={href} className="text-sm">
          See all
        </EntityLink>
      )}
    </div>
  );
}

function FeaturedPeople() {
  const featured = usePeopleFeatured(6);
  return (
    <section>
      <SectionHeading title="People across multiple consortia" href="/directory?tab=people" />
      {featured.isLoading ? (
        <SkeletonRows count={4} />
      ) : !featured.data?.length ? (
        <Card className="p-6 text-sm text-ink-secondary">
          No multi-consortium people surfaced yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {featured.data.map((p) => (
            <Card key={p.id} className="p-4 transition-shadow hover:shadow-[0_1px_4px_rgba(16,24,40,.08)]">
              <div className="flex items-start justify-between gap-2">
                <EntityLink to={`/people/${p.id}`} className="text-[15px]">
                  {p.full_name}
                </EntityLink>
                <IllustrativeBadge status={p.verification_status} />
              </div>
              <div className="mt-1 text-xs text-ink-secondary">
                {[p.title, p.highest_qualification].filter(Boolean).join(" · ")}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <ConsortiaChip count={p.consortia_count} />
                {p.specializations.slice(0, 2).map((s) => (
                  <Tag key={s}>{s}</Tag>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentlyAdded() {
  const recent = useProjects({ sort: "recent", limit: "6" });
  return (
    <section>
      <SectionHeading title="Recently added projects" href="/directory?tab=projects" />
      {recent.isLoading ? (
        <SkeletonRows count={4} />
      ) : !recent.data?.length ? (
        <Card className="p-6 text-sm text-ink-secondary">Nothing recent to show.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {recent.data.map((pr) => (
            <Card key={pr.id} className="p-4">
              <EntityLink to={`/projects/${pr.id}`} className="text-[15px]">
                {pr.title}
              </EntityLink>
              <div className="mt-1 flex flex-wrap gap-1">
                {pr.themes.slice(0, 3).map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function BrowseTiles() {
  const tiles = [
    { label: "Programmes", tab: "programmes" },
    { label: "Projects", tab: "projects" },
    { label: "Organisations", tab: "organizations" },
    { label: "People", tab: "people" },
    { label: "Capabilities", tab: "capabilities" },
  ];
  return (
    <section>
      <SectionHeading title="Browse the directory" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((t) => (
          <EntityLink
            key={t.tab}
            to={`/directory?tab=${t.tab}`}
            className="rounded-xl border border-border px-4 py-6 text-center text-sm font-medium hover:border-brand"
          >
            {t.label}
          </EntityLink>
        ))}
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-border pt-6 text-xs text-ink-secondary">
      <p>
        Research Atlas is a public, read-only directory aggregated from public sources.
        Every record links back to its source and is labelled "unverified" until claimed.
        No contact details are shown.
      </p>
    </footer>
  );
}

