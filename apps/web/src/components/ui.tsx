import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { Link } from "react-router-dom";
import { cn } from "../lib/cn";
import { formatUpdated } from "../lib/format";

/** Primitive set matching the Partner Dashboard design system (light, airy). */

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "accent" | "danger" | "ghost";
}) {
  const variants: Record<string, string> = {
    primary: "bg-brand text-brand-fg hover:bg-brand-hover",
    accent: "bg-accent text-accent-fg hover:bg-accent-hover",
    secondary: "bg-surface text-gray-700 border border-hairline hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-gray-600 hover:bg-gray-100",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-hairline bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-brand/20",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-brand/20",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      {children}
    </label>
  );
}

type Tone = "green" | "blue" | "amber" | "red" | "gray";

export function StatusPill({
  tone = "gray",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  const tones: Record<Tone, string> = {
    green: "bg-green-50 text-green-700 ring-green-200",
    blue: "bg-brand-subtle text-brand ring-brand/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    gray: "bg-gray-100 text-gray-600 ring-gray-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Provenance badge — every ingested, not-yet-claimed record shows "unverified". */
export function IllustrativeBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  if (status === "verified" || status === "claimed") return null;
  return <StatusPill tone="amber">Unverified</StatusPill>;
}

export function MonoCode({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
      {children}
    </span>
  );
}

/* ── Crunchbase-style profile building blocks ──────────────────────────────── */

/** Every entity name is a blue link — this drives the bidirectional graph nav. */
export function EntityLink({
  to,
  children,
  className,
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "font-medium text-brand hover:underline focus:underline focus:outline-none",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Flat grey pill for themes / skills / roles. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-tag-bg px-2 py-0.5 text-xs font-medium text-tag-ink">
      {children}
    </span>
  );
}

/** Squared logo/avatar; falls back to a monogram of the name. */
export function Monogram({
  name,
  src,
  size = 56,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-md border border-border object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="grid shrink-0 place-items-center rounded-md bg-surface-alt font-semibold text-ink-secondary"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials || "?"}
    </div>
  );
}

export type Crumb = { label: string; to?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-secondary">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {c.to ? (
            <Link to={c.to} className="hover:text-brand hover:underline">
              {c.label}
            </Link>
          ) : (
            <span className="text-ink">{c.label}</span>
          )}
          {i < items.length - 1 && <span className="text-border">/</span>}
        </span>
      ))}
    </nav>
  );
}

/** Titled white card with a hairline border — the Crunchbase profile primitive. */
export function SectionCard({
  title,
  count,
  seeAll,
  children,
}: {
  title: string;
  count?: number;
  seeAll?: { to: string; label?: string };
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-white">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[15px] font-semibold text-ink">
          {title}
          {count != null && (
            <span className="ml-1.5 font-normal tabular-nums text-ink-secondary">
              {count}
            </span>
          )}
        </h2>
        {seeAll && (
          <Link
            to={seeAll.to}
            className="text-[13px] font-medium text-brand hover:underline"
          >
            {seeAll.label ?? "See all"}
          </Link>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** A horizontal label/value key-facts row (profile header band). */
export function KeyFacts({
  facts,
}: {
  facts: { label: string; value: ReactNode }[];
}) {
  const shown = facts.filter((f) => f.value != null && f.value !== "");
  if (!shown.length) return null;
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-3">
      {shown.map((f, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-secondary">
            {f.label}
          </dt>
          <dd className="mt-0.5 text-sm text-ink">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Provenance line — "Sourced from [X] · unverified", with link-back. */
export function ProvenanceLine({
  source,
  sourceUrl,
  status,
}: {
  source?: string | null;
  sourceUrl?: string | null;
  status?: string | null;
}) {
  const verified = status === "verified" || status === "claimed";
  return (
    <p className="text-xs text-ink-secondary">
      Sourced from{" "}
      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-brand hover:underline"
        >
          {source || "public data"}
        </a>
      ) : (
        <span className="text-ink">{source || "public data"}</span>
      )}{" "}
      · {verified ? "verified" : "unverified"}
    </p>
  );
}

/**
 * Inert V2 signpost on person profiles. Discovery is public; claiming is a
 * future, private concern — so this is deliberately non-interactive: no link,
 * no form, no contact. Just a quiet "coming soon" note.
 */
export function ClaimStub() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-alt p-4">
      <h3 className="text-[13px] font-semibold text-ink">Is this you?</h3>
      <p className="mt-1 text-xs text-ink-secondary">
        Profile claiming is coming soon.
      </p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-surface-alt motion-reduce:animate-none", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border p-4">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** "in N consortia" — the cross-consortium hero teaser. Prominent at >=2. */
export function ConsortiaChip({ count }: { count: number }) {
  if (count < 1) return null;
  const strong = count >= 2;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        strong ? "bg-brand-subtle text-brand" : "bg-tag-bg text-tag-ink",
      )}
      title={strong ? "Appears across multiple consortia" : undefined}
    >
      in {count} {count === 1 ? "consortium" : "consortia"}
    </span>
  );
}

/** Quiet "last updated" stamp from a record's ingested_at; renders nothing if absent. */
export function UpdatedLine({ ingestedAt }: { ingestedAt?: string | null }) {
  const label = formatUpdated(ingestedAt);
  if (!label) return null;
  return <p className="text-xs text-ink-secondary">{label}</p>;
}

/** Standard loading / error / not-found state for a profile page. */
export function PageStatus({
  loading,
  error,
  notFound,
  label,
}: {
  loading?: boolean;
  error?: boolean;
  notFound?: boolean;
  label: string;
}) {
  let message = `Loading ${label}…`;
  if (notFound) message = `${label} not found.`;
  else if (error) message = `Couldn't load ${label}. Please try again.`;
  return (
    <div className="rounded-lg border border-border bg-white p-10 text-center text-sm text-ink-secondary">
      {message}
    </div>
  );
}
