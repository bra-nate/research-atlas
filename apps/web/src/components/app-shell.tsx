import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

/**
 * Public app chrome — a deep-green institutional top nav (sticky): wordmark
 * left, a prominent translucent global search with a scope selector, and a
 * quiet "read-only" marker (V1 is read-only discovery; no account/sign-in).
 * Profile pages render their own breadcrumbs below the nav. The root clips
 * horizontal overflow so pages can use full-bleed colour bands (.full-bleed).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("all");

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (scope !== "all") params.set("tab", scope);
    if (q.trim()) params.set("q", q.trim());
    const qsStr = params.toString();
    navigate(`/directory${qsStr ? `?${qsStr}` : ""}`);
  }

  return (
    <div className="min-h-full overflow-x-clip bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-brand focus:shadow-lift"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 bg-brand-deep text-white/90">
        <div className="mx-auto flex h-16 max-w-shell items-center gap-3 px-4 sm:gap-5 sm:px-6">
          <Link to="/" className="group flex shrink-0 items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-emerald font-display text-[15px] font-bold text-brand-deep">
              R
            </span>
            <span className="font-display text-[15px] font-bold tracking-tight text-white">
              Research<span className="text-emerald">Atlas</span>
            </span>
          </Link>

          <form onSubmit={onSearch} className="relative ml-1 max-w-lg flex-1">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              aria-label="Search scope"
              className="absolute left-1.5 top-1/2 hidden w-[124px] -translate-y-1/2 truncate rounded-md bg-white/10 py-1 pl-2 pr-6 text-xs font-medium text-white/80 outline-none ring-0 focus:bg-white/15 sm:block"
            >
              <option className="text-ink" value="all">All</option>
              <option className="text-ink" value="programmes">Programmes</option>
              <option className="text-ink" value="projects">Projects</option>
              <option className="text-ink" value="organizations">Organisations</option>
              <option className="text-ink" value="people">People</option>
              <option className="text-ink" value="capabilities">Capabilities</option>
              <option className="text-ink" value="publications">Publications</option>
            </select>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search programmes, projects, organisations, people, capabilities, publications"
              placeholder="Search the African research ecosystem…"
              className="w-full rounded-lg border border-white/15 bg-white/10 py-2 pl-3 pr-3 text-sm text-white outline-none transition placeholder:text-white/50 focus:border-emerald/60 focus:bg-white/15 focus:ring-2 focus:ring-emerald/30 sm:pl-[9rem]"
            />
          </form>

          <Link
            to="/directory"
            className="hidden shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white sm:block"
          >
            Browse
          </Link>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70 md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
            Public · read-only
          </span>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-shell px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
