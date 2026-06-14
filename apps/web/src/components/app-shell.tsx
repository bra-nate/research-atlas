import { Building2, LayoutGrid, Search } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "../lib/cn";

const NAV = [{ to: "/directory", label: "Directory", icon: Search }];

/** Public app chrome — no account/sign-in (V1 is read-only discovery). */
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const crumb =
    NAV.find((n) => location.pathname.startsWith(n.to))?.label ?? "Discover";

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-hairline bg-surface">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-fg">
            <LayoutGrid className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Research Atlas</div>
            <div className="text-[11px] text-gray-500">African research ecosystem</div>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-0.5 px-2">
          <div className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Discover
          </div>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-subtle text-brand"
                    : "text-gray-600 hover:bg-gray-100",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="m-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-gray-400">
          <Building2 className="h-3.5 w-3.5" /> Public · read-only
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-hairline bg-surface px-6 py-3">
          <div className="text-sm text-gray-500">
            Discover <span className="text-gray-300">/</span>{" "}
            <span className="font-medium text-gray-900">{crumb}</span>
          </div>
          <div className="text-xs text-gray-400">Sourced from public data · unverified</div>
        </header>
        <main className="flex-1 overflow-auto bg-canvas px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
