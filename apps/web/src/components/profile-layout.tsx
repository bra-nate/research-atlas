import type { ReactNode } from "react";
import { KeyFacts, Monogram } from "./ui";

/**
 * The Crunchbase profile shell: a full-width header band (logo/avatar, name,
 * one-line descriptor, key-facts row) over a two-column body — a sticky left
 * summary rail plus a stacked main column of section cards.
 */

export function ProfileHeader({
  name,
  monogramSrc,
  descriptor,
  facts,
  badge,
}: {
  name: string;
  monogramSrc?: string | null;
  descriptor?: ReactNode;
  facts?: { label: string; value: ReactNode }[];
  badge?: ReactNode;
}) {
  return (
    <header className="mb-5 flex gap-4">
      <Monogram name={name} src={monogramSrc} size={64} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink">
            {name}
          </h1>
          {badge}
        </div>
        {descriptor && (
          <p className="mt-1 text-sm text-ink-secondary">{descriptor}</p>
        )}
        {facts && facts.length > 0 && (
          <div className="mt-4">
            <KeyFacts facts={facts} />
          </div>
        )}
      </div>
    </header>
  );
}

export function TwoColumn({
  rail,
  children,
}: {
  rail: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">{rail}</aside>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/** A titled block inside the summary rail. */
export function RailBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
        {title}
      </h3>
      {children}
    </div>
  );
}
