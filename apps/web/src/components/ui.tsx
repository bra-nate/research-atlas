import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "../lib/cn";

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

/** The mandated "Illustrative — unverified" badge for seeded data. */
export function IllustrativeBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  if (status !== "seeded_unverified") return null;
  return <StatusPill tone="amber">Illustrative — unverified</StatusPill>;
}

export function MonoCode({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
      {children}
    </span>
  );
}
