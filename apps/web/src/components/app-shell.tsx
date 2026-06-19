import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

/**
 * Public app chrome — Crunchbase-style top nav (white, sticky, hairline border):
 * wordmark left, a prominent global search with scope selector, no account/sign-in
 * (V1 is read-only discovery). Profile pages render their own breadcrumbs below the nav.
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
    <div className="min-h-full bg-white">
      <header className="sticky top-0 z-20 border-b border-border bg-white">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-brand text-white">
              <span className="font-semibold">R</span>
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-ink">
              Research Atlas
            </span>
          </Link>

          <form onSubmit={onSearch} className="relative max-w-md flex-1">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              aria-label="Search scope"
              className="absolute left-1 top-1/2 hidden -translate-y-1/2 rounded-md bg-transparent py-1 pl-2 pr-1 text-xs text-ink-secondary sm:block"
            >
              <option value="all">All</option>
              <option value="programmes">Programmes</option>
              <option value="projects">Projects</option>
              <option value="organizations">Organisations</option>
              <option value="people">People</option>
              <option value="capabilities">Capabilities</option>
              <option value="publications">Publications</option>
            </select>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search programmes, projects, organisations, people, capabilities, publications"
              placeholder="Search the African research ecosystem…"
              className="w-full rounded-lg border border-border bg-surface-alt py-2 pl-3 pr-3 text-sm text-ink outline-none placeholder:text-ink-secondary focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20 sm:pl-28"
            />
          </form>

          <span className="ml-auto hidden text-xs text-ink-secondary sm:block">
            Public · read-only
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
