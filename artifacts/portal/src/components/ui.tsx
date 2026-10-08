import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "wouter";
import clsx from "clsx";
import { X } from "lucide-react";

const btnBase =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 cursor-pointer";
const variants = {
  primary: "bg-[var(--brand)] text-white hover:bg-[var(--brand)]/90 h-9 px-4",
  outline: "border border-[var(--line-strong)] bg-[var(--surface)] shadow-[var(--shadow-sm)] hover:bg-[var(--surface-2)] h-8 px-3",
  ghost: "hover:bg-[var(--surface-2)] size-9",
};

export function Button({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return <button className={clsx(btnBase, variants[variant], className)} {...p} />;
}
export function LinkButton({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return <Link href={href} className={clsx(btnBase, variants.primary, className)}>{children}</Link>;
}

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx("flex flex-col rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]", className)} {...p} />
);

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        tone === "brand"
          ? "border-[color-mix(in_oklch,var(--brand)_30%,transparent)] bg-[var(--brand-soft)] text-[var(--brand-ink)]"
          : "border-transparent bg-[var(--surface-2)] text-[var(--ink)]",
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--ink-soft)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--r-lg)] border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 py-12 text-center">
      {icon && <div className="grid size-10 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-ink)]">{icon}</div>}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
        {body && <p className="max-w-sm text-sm text-[var(--ink-soft)]">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-[var(--r-lg)] bg-[var(--surface-2)]", className)} />;
}

export function Dialog({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-lg rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)]">
        <button aria-label="Close" onClick={onClose} className="absolute top-4 right-4 text-[var(--ink-mute)] hover:text-[var(--ink)] cursor-pointer"><X className="size-4" /></button>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-[var(--ink-mute)]">{description}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export const fieldLabel = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--ink-soft)]";
export const fieldInput =
  "h-9 w-full rounded-md border border-[var(--line-strong)] bg-transparent px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-[3px] focus:ring-[var(--brand)]/20 disabled:opacity-50";
// Same look as fieldInput but without forcing full width, for selects and short fields that set their own width.
export const fieldCompact = fieldInput.replace(" w-full", "");
