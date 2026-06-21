import { Link, useNavigate } from "react-router-dom";
import { useState, type FormEvent, type ReactNode } from "react";
import { usePeopleFeatured, useProjects, useStats } from "../lib/hooks";
import type { StatsResponse } from "@research-atlas/types";
import {
  ConsortiaChip,
  IllustrativeBadge,
  Monogram,
  Skeleton,
  SkeletonRows,
  Tag,
} from "../components/ui";

const SCOPES = [
  { value: "all", label: "All" },
  { value: "programmes", label: "Programmes" },
  { value: "projects", label: "Projects" },
  { value: "organizations", label: "Orgs" },
  { value: "people", label: "People" },
  { value: "capabilities", label: "Capabilities" },
];

export function LandingPage() {
  return (
    <div className="space-y-16 sm:space-y-20">
      <Hero />
      <StatsBand />
      <FeaturedPeople />
      <RecentlyAdded />
      <BrowseTiles />
      <SiteFooter />
    </div>
  );
}

/* ── Eyebrow + section heading ──────────────────────────────────────────── */

function Eyebrow({ children, on = "light" }: { children: ReactNode; on?: "light" | "dark" }) {
  return (
    <p
      className={
        "font-display text-[11px] font-bold uppercase tracking-[0.18em] " +
        (on === "dark" ? "text-emerald" : "text-brand")
      }
    >
      {children}
    </p>
  );
}

function SectionHead({
  eyebrow,
  title,
  blurb,
  href,
  hrefLabel = "See all",
}: {
  eyebrow: string;
  title: string;
  blurb?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="max-w-2xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink sm:text-[26px]">
          {title}
        </h2>
        {blurb && <p className="mt-2 text-sm text-ink-secondary">{blurb}</p>}
      </div>
      {href && (
        <Link
          to={href}
          className="shrink-0 text-sm font-semibold text-brand hover:underline"
        >
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}

/* ── Hero ───────────────────────────────────────────────────────────────── */

function Hero() {
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
    <section className="full-bleed -mt-8 bg-brand-deep text-white">
      <div className="relative overflow-hidden">
        {/* dot-grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        {/* soft emerald glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-emerald/20 blur-3xl"
        />

        <div className="shell-inner relative grid gap-12 py-16 sm:py-20 lg:grid-cols-[1.45fr_1fr] lg:items-center">
          <div>
            <Eyebrow on="dark">The African research ecosystem</Eyebrow>
            <h1 className="mt-3 max-w-2xl font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
              The map of{" "}
              <span className="text-emerald">African research</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
              Programmes, consortia, organisations and the people behind them —
              their funding and their publications, woven into one navigable
              graph. Aggregated from public sources, free to browse.
            </p>

            <form onSubmit={onSearch} className="mt-8 max-w-xl">
              <div
                role="radiogroup"
                aria-label="Search scope"
                className="mb-2.5 flex flex-wrap gap-1.5"
              >
                {SCOPES.map((sc) => {
                  const active = scope === sc.value;
                  return (
                    <button
                      type="button"
                      key={sc.value}
                      role="radio"
                      aria-checked={active}
                      onClick={() => setScope(sc.value)}
                      className={
                        "rounded-full px-3 py-1 text-[13px] font-medium transition " +
                        (active
                          ? "bg-white text-brand-deep"
                          : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white")
                      }
                    >
                      {sc.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search the directory"
                  placeholder="Search a person, programme, organisation…"
                  className="flex-1 rounded-xl border border-white/15 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-ink-secondary/70 focus:ring-2 focus:ring-emerald/50"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-fg shadow-lift transition hover:bg-accent-hover"
                >
                  Search
                </button>
              </div>
            </form>

            <p className="mt-4 text-[13px] text-white/55">
              No accounts. No contact details. Pure discovery — every record
              links back to its source.
            </p>
          </div>

          {/* connection-graph motif — reinforces the cross-consortium hero feature */}
          <GraphMotif />
        </div>
      </div>
    </section>
  );
}

/** Decorative node-and-edge graph hinting at cross-consortium connections. */
function GraphMotif() {
  return (
    <div aria-hidden className="relative hidden lg:block">
      <svg viewBox="0 0 320 300" className="h-auto w-full max-w-sm">
        <g
          stroke="rgba(21,160,107,0.55)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        >
          <path d="M160 150 L70 60" />
          <path d="M160 150 L250 70" />
          <path d="M160 150 L60 210" />
          <path d="M160 150 L260 220" />
          <path d="M160 150 L160 260" />
          <path d="M70 60 L250 70" opacity="0.4" />
          <path d="M60 210 L160 260" opacity="0.4" />
        </g>
        {[
          [160, 150, 11, "#15A06B"],
          [70, 60, 7, "#ffffff"],
          [250, 70, 7, "#ffffff"],
          [60, 210, 7, "#ffffff"],
          [260, 220, 7, "#ffffff"],
          [160, 260, 7, "#ffffff"],
        ].map(([cx, cy, r, fill], i) => (
          <circle
            key={i}
            cx={cx as number}
            cy={cy as number}
            r={r as number}
            fill={fill as string}
            opacity={fill === "#ffffff" ? 0.85 : 1}
          />
        ))}
        <circle cx={160} cy={150} r={20} fill="none" stroke="#15A06B" strokeWidth="1.5" opacity="0.4" />
      </svg>
    </div>
  );
}

/* ── Stats band ─────────────────────────────────────────────────────────── */

function StatsBand() {
  const stats = useStats();
  const items: { label: string; key: keyof StatsResponse }[] = [
    { label: "People", key: "people" },
    { label: "Programmes", key: "programmes" },
    { label: "Projects", key: "projects" },
    { label: "Organisations", key: "organizations" },
    { label: "Publications", key: "publications" },
  ];
  return (
    <section className="full-bleed bg-brand-deeper text-white">
      <div className="shell-inner py-12 sm:py-14">
        <Eyebrow on="dark">The atlas, by the numbers</Eyebrow>
        <dl className="mt-6 grid grid-cols-2 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((it, i) => (
            <div
              key={it.key}
              className={
                "px-1 sm:px-6 " +
                (i === 0 ? "" : "sm:border-l sm:border-white/10")
              }
            >
              <dd className="font-display text-4xl font-bold tabular-nums leading-none sm:text-5xl">
                {stats.data ? (
                  (stats.data[it.key] as number).toLocaleString()
                ) : (
                  <Skeleton className="h-10 w-20 bg-white/15" />
                )}
              </dd>
              <dt className="mt-2.5 text-[13px] font-medium uppercase tracking-wide text-white/55">
                {it.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ── Featured people (the hero feature) ─────────────────────────────────── */

function FeaturedPeople() {
  const featured = usePeopleFeatured(6);
  return (
    <section>
      <SectionHead
        eyebrow="Why this exists"
        title="People across multiple consortia"
        blurb="The same researcher often appears in programme after programme — under WACCBIP, H3Africa, a DELTAS grant. No source portal shows that span. This does."
        href="/directory?tab=people"
        hrefLabel="All people"
      />
      {featured.isLoading ? (
        <SkeletonRows count={4} />
      ) : !featured.data?.length ? (
        <EmptyNote>No multi-consortium people surfaced yet.</EmptyNote>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.data.map((p) => (
            <Link
              key={p.id}
              to={`/people/${p.id}`}
              className="group flex flex-col rounded-2xl border border-border bg-white p-5 shadow-card transition duration-150 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lift"
            >
              <div className="flex items-start gap-3.5">
                <Monogram name={p.full_name} size={44} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-ink group-hover:text-brand">
                    {p.full_name}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-ink-secondary">
                    {[p.title, p.highest_qualification].filter(Boolean).join(" · ") ||
                      "Researcher"}
                  </p>
                </div>
                <IllustrativeBadge status={p.verification_status} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <ConsortiaChip count={p.consortia_count} />
                {p.specializations.slice(0, 2).map((s) => (
                  <Tag key={s}>{s}</Tag>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Recently added projects ────────────────────────────────────────────── */

function RecentlyAdded() {
  const recent = useProjects({ sort: "recent", limit: "6" });
  return (
    <section>
      <SectionHead
        eyebrow="Fresh in the atlas"
        title="Recently added projects"
        href="/directory?tab=projects"
        hrefLabel="All projects"
      />
      {recent.isLoading ? (
        <SkeletonRows count={4} />
      ) : !recent.data?.length ? (
        <EmptyNote>Nothing recent to show.</EmptyNote>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {recent.data.map((pr) => (
            <Link
              key={pr.id}
              to={`/projects/${pr.id}`}
              className="group rounded-2xl border border-border bg-white p-5 shadow-card transition duration-150 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lift"
            >
              <h3 className="font-semibold leading-snug text-ink group-hover:text-brand">
                {pr.title}
              </h3>
              {pr.themes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pr.themes.slice(0, 3).map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Browse tiles ───────────────────────────────────────────────────────── */

function BrowseTiles() {
  const stats = useStats();
  const tiles: { label: string; tab: string; key?: keyof StatsResponse }[] = [
    { label: "Programmes", tab: "programmes", key: "programmes" },
    { label: "Projects", tab: "projects", key: "projects" },
    { label: "Organisations", tab: "organizations", key: "organizations" },
    { label: "People", tab: "people", key: "people" },
    { label: "Capabilities", tab: "capabilities", key: "capabilities" },
    { label: "Publications", tab: "publications", key: "publications" },
  ];
  return (
    <section>
      <SectionHead eyebrow="Start anywhere" title="Browse the directory" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <Link
            key={t.tab}
            to={`/directory?tab=${t.tab}`}
            className="group flex flex-col justify-between rounded-2xl border border-border bg-white p-4 transition duration-150 hover:-translate-y-0.5 hover:border-brand hover:bg-brand-subtle/40"
          >
            <span className="font-display text-xl font-bold tabular-nums text-brand">
              {t.key && stats.data
                ? (stats.data[t.key] as number).toLocaleString()
                : "—"}
            </span>
            <span className="mt-6 flex items-center justify-between text-sm font-medium text-ink">
              {t.label}
              <span className="text-ink-secondary transition group-hover:translate-x-0.5 group-hover:text-brand">
                →
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-alt p-8 text-center text-sm text-ink-secondary">
      {children}
    </div>
  );
}

/* ── Footer ─────────────────────────────────────────────────────────────── */

function SiteFooter() {
  const cols: { heading: string; links: { label: string; to: string }[] }[] = [
    {
      heading: "Browse",
      links: [
        { label: "Programmes", to: "/directory?tab=programmes" },
        { label: "Projects", to: "/directory?tab=projects" },
        { label: "Organisations", to: "/directory?tab=organizations" },
        { label: "People", to: "/directory?tab=people" },
      ],
    },
    {
      heading: "Explore",
      links: [
        { label: "Capabilities", to: "/directory?tab=capabilities" },
        { label: "Publications", to: "/directory?tab=publications" },
        { label: "Full directory", to: "/directory" },
      ],
    },
  ];
  return (
    <footer className="full-bleed -mb-8 bg-brand-deep text-white/70">
      <div className="shell-inner grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2 lg:max-w-sm">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-emerald font-display text-[15px] font-bold text-brand-deep">
              R
            </span>
            <span className="font-display text-[15px] font-bold tracking-tight text-white">
              Research<span className="text-emerald">Atlas</span>
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed">
            A public, read-only directory of the African research ecosystem,
            aggregated from public sources. Every record links back to its
            source. No contact details are shown.
          </p>
        </div>
        {cols.map((c) => (
          <nav key={c.heading} aria-label={c.heading}>
            <h2 className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-emerald">
              {c.heading}
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="transition hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="shell-inner flex flex-col gap-2 py-5 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>Research Atlas · public &amp; free to browse</p>
          <p>Discovery is public; contact is private.</p>
        </div>
      </div>
    </footer>
  );
}
