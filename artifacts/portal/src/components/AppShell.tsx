import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, CalendarClock, Calendar, Columns3, Gauge, KeyRound, LayoutDashboard, LogOut, Settings as SettingsIcon, Square, Truck, UserRound, Users } from "lucide-react";
import clsx from "clsx";
import { api, type Me } from "@/lib/api";

const nav = [
  { href: "/app", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/app/rooms", label: "Rooms", icon: Calendar },
  { href: "/app/me", label: "Personal area", icon: UserRound },
];
const adminNav = [
  { href: "/app/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/app/issues", label: "Issues", icon: Columns3 },
  { href: "/app/bookings", label: "Bookings", icon: CalendarClock },
  { href: "/app/metrics", label: "Metrics", icon: Activity },
  { href: "/app/suppliers", label: "Suppliers", icon: Truck },
  { href: "/app/tags", label: "Tags", icon: KeyRound },
  { href: "/app/users", label: "Users", icon: Users },
  { href: "/app/settings", label: "Settings", icon: SettingsIcon },
];

export default function AppShell({ me, children }: { me: Me; children: ReactNode }) {
  const [loc] = useLocation();
  const qc = useQueryClient();
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSuccess: () => { qc.clear(); window.location.href = "/login"; },
  });
  const items: { href: string; label: string; icon: typeof Gauge; exact?: boolean }[] = me.role === "admin" ? [...nav, ...adminNav] : nav;
  const pending = useQuery({ queryKey: ["inbox-count"], queryFn: () => api<{ pending: number }>("/inbox/count"), enabled: me.role === "admin", refetchInterval: 60_000 });
  const initials = me.name.slice(0, 2).toUpperCase();

  return (
    <div className="grid min-h-screen grid-cols-[205px_1fr] bg-[var(--bg)] text-[var(--ink)] max-md:grid-cols-1">
      <div className="sticky top-0 h-screen overflow-y-auto max-md:hidden">
        <aside className="flex h-screen flex-col gap-4 border-r border-[var(--line)] bg-[var(--surface)] px-3 py-5">
          <div className="flex items-center gap-2 px-2 pb-2">
            <span className="text-[var(--brand)]"><Square className="size-5 fill-current" /></span>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">Office</div>
              <div className="text-[11px] uppercase tracking-wide text-[var(--ink-mute)]">{me.name}</div>
            </div>
          </div>
          <nav className="flex flex-col gap-0.5">
            {items.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? loc === href : loc === href || loc.startsWith(href + "/");
              return (
                <Link key={href} href={href} className={clsx("relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors", active ? "bg-[var(--surface-2)] text-[var(--ink)]" : "text-[var(--ink-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]")}>
                  {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-[var(--brand)]" />}
                  <Icon className={clsx("size-4", active ? "text-[var(--brand)]" : "text-[var(--ink-mute)]")} />
                  {label}
                  {href === "/app/dashboard" && !!pending.data?.pending && <span className="tnum ml-auto rounded-full bg-[var(--brand)] px-1.5 text-[10px] font-semibold text-white">{pending.data.pending}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto flex items-center gap-2.5 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-[var(--shadow-sm)]">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--ink-soft)]">{initials}</span>
            <Link href="/app/account" className="min-w-0 flex-1" title="Account and password">
              <div className="truncate text-sm font-semibold">{me.name}</div>
              <div className="truncate text-xs text-[var(--ink-mute)]">{me.email}</div>
            </Link>
            <button aria-label="Sign out" onClick={() => logout.mutate()} className="grid size-7 place-items-center rounded-md text-[var(--ink-mute)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] cursor-pointer"><LogOut className="size-4" /></button>
          </div>
        </aside>
      </div>
      <main className="min-w-0 px-10 py-8 max-md:px-4 max-md:py-5">
        <nav className="mb-4 hidden gap-1 overflow-x-auto max-md:flex">
          {items.map(({ href, label, exact }) => (
            <Link key={href} href={href} className={clsx("rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap", (exact ? loc === href : loc === href || loc.startsWith(href + "/")) ? "bg-[var(--surface-2)]" : "text-[var(--ink-soft)]")}>{label}</Link>
          ))}
        </nav>
        {children}
      </main>
    </div>
  );
}
