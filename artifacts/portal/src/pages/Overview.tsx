import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Calendar, Plus } from "lucide-react";
import { AnnouncementItem } from "@/pages/Announcements";
import { api, type Allowance, type Announcement, type Booking, type Me, type Room, type Summary } from "@/lib/api";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Skeleton } from "@/components/ui";
import { CLOSE, OPEN, addDays, fmtDay, hm, hourOf, lisbonToUtc, todayStr, ymd } from "@/lib/time";

function RoomToday({ room, bookings }: { room: Room; bookings: Booking[] }) {
  const span = CLOSE - OPEN;
  const pos = (at: string) => Math.min(100, Math.max(0, ((hourOf(at) - OPEN) / span) * 100));
  const now = new Date();
  const busyNow = bookings.find((b) => new Date(b.startsAt) <= now && new Date(b.endsAt) > now);
  const next = bookings.find((b) => new Date(b.startsAt) > now);
  return (
    <div className="rounded-[var(--r-lg)] border border-[var(--line)] p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full" style={{ background: room.color }} />
          <div className="text-sm font-semibold">{room.name}</div>
        </div>
        <Badge>{room.seats} seats</Badge>
      </div>
      <div className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        {bookings.map((b) => (
          <div key={b.id} className="absolute h-full" style={{ left: `${pos(b.startsAt)}%`, width: `${pos(b.endsAt) - pos(b.startsAt)}%`, background: room.color }} />
        ))}
      </div>
      <div className="mt-2 text-xs text-[var(--ink-mute)]">
        {!bookings.length ? "Free all day" : busyNow ? `Busy until ${hm(busyNow.endsAt)}` : next ? `Free until ${hm(next.startsAt)}` : "Free for the rest of the day"}
      </div>
    </div>
  );
}

function Left({ label, a }: { label: string; a: Allowance }) {
  const left = a.limit == null ? null : Math.max(0, a.limit - a.used);
  return (
    <div>
      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--ink-mute)]">{label}</div>
      <div className="tnum mt-1 text-2xl font-semibold">
        {left == null ? "∞" : left}
        <span className="ml-1 text-sm font-medium text-[var(--ink-mute)]">{left == null ? "no limit" : `left of ${a.limit}`}</span>
      </div>
      <div className="mt-0.5 text-xs text-[var(--ink-mute)]">{a.used} used this month</div>
    </div>
  );
}

export default function Overview({ me }: { me: Me }) {
  const today = todayStr();
  const news = useQuery({ queryKey: ["announcements"], queryFn: () => api<Announcement[]>("/announcements") });
  const summary = useQuery({ queryKey: ["summary"], queryFn: () => api<Summary>("/summary") });
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: () => api<Room[]>("/rooms") });
  const from = lisbonToUtc(today, "00:00").toISOString(), to = lisbonToUtc(addDays(today, 1), "00:00").toISOString();
  const bookings = useQuery({ queryKey: ["bookings", "today", from], queryFn: () => api<Booking[]>(`/bookings?from=${from}&to=${to}`) });
  const roomName = (id: string) => rooms.data?.find((r) => r.id === id)?.name ?? "Room";
  const s = summary.data;
  const nothing = s && !s.upcoming.length && !s.upcomingDesks.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Welcome, ${me.name}`} subtitle={fmtDay(today, { weekday: "long", day: "numeric", month: "long" })}
        actions={<LinkButton href="/app/book"><Plus className="size-3.5" />Book a room</LinkButton>} />

      {!!news.data?.length && (
        <section aria-label="Announcements">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Announcements</h2><Link href="/app/announcements" className="text-xs font-medium text-[var(--brand)] hover:underline">See all →</Link></div>
          <ul className="flex flex-col gap-2">{news.data.slice(0, 2).map((a) => <AnnouncementItem key={a.id} a={a} compact />)}</ul>
        </section>
      )}

      {!!s?.updatedReports && (
        <Link href="/app/report" className="rounded-[var(--r-lg)] border border-[color-mix(in_oklch,var(--brand)_30%,transparent)] bg-[var(--brand-soft)] px-4 py-3 text-sm text-[var(--brand-ink)]">
          {s.updatedReports === 1 ? "Your report has an update" : `${s.updatedReports} of your reports have updates`} — see what changed →
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Your upcoming reservations</h2>
            <Link href="/app/history" className="text-xs font-medium text-[var(--brand)] hover:underline">See all →</Link>
          </div>
          {summary.isLoading ? <Skeleton className="h-40" /> : nothing ? (
            <EmptyState icon={<Calendar className="size-5" />} title="Nothing booked yet" body="Reserve a seat or a meeting room to get started."
              action={<LinkButton href="/app/book"><Plus className="size-3.5" />Book your first room</LinkButton>} />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--line)]">
              {s?.upcomingDesks.map((d) => (
                <li key={d} className="flex items-center justify-between gap-3 py-2.5">
                  <div><div className="text-sm font-medium">Desk seat</div><div className="text-xs text-[var(--ink-mute)]">Hot desk · all day</div></div>
                  <div className="tnum text-right text-xs text-[var(--ink-soft)]">{fmtDay(d, { weekday: "short", day: "numeric", month: "short" })}</div>
                </li>
              ))}
              {s?.upcoming.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{b.title}</div>
                    <div className="text-xs text-[var(--ink-mute)]">{roomName(b.roomId)} · {b.attendees} attending</div>
                  </div>
                  <div className="tnum text-right text-xs text-[var(--ink-soft)]">
                    <div>{fmtDay(ymd(b.startsAt), { weekday: "short", day: "numeric", month: "short" })}</div>
                    <div>{hm(b.startsAt)} – {hm(b.endsAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="flex flex-col gap-3 p-5">
          <div>
            <div className="text-[12.5px] text-[var(--ink-mute)]">Your plan</div>
            <div className="mt-1 text-base font-semibold">{s?.plan ?? me.plan}</div>
          </div>
          {s ? (
            <div className="grid grid-cols-2 gap-3">
              <Left label="Desk days" a={s.deskDays} />
              <Left label="Room days" a={s.roomDays} />
            </div>
          ) : <Skeleton className="h-16" />}
          <div className="grid grid-cols-2 gap-3 text-xs text-[var(--ink-mute)]">
            <div><span className="tnum font-semibold text-[var(--ink)]">{s?.totalBookings ?? "–"}</span> room bookings in total</div>
            <div><span className="tnum font-semibold text-[var(--ink)]">{s?.hoursThisMonth ?? "–"}h</span> in rooms this month</div>
          </div>
          <hr className="my-1 border-t border-[var(--line)]" />
          <div>
            <h3 className="mb-1.5 text-sm font-semibold">Office hours</h3>
            <div className="mono tnum text-sm text-[var(--ink-soft)]">Mon – Fri · {String(OPEN).padStart(2, "0")}:00 – {CLOSE}:00</div>
            <p className="mt-1.5 text-xs text-[var(--ink-mute)]">Bookings are free for clients. Desks are billed monthly off-platform.</p>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Rooms today</h2>
          <Link href="/app/book" className="text-xs font-medium text-[var(--brand)] hover:underline">Open calendar →</Link>
        </div>
        {rooms.isLoading ? <Skeleton className="h-20" /> : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.data?.map((r) => <RoomToday key={r.id} room={r} bookings={(bookings.data ?? []).filter((b) => b.roomId === r.id).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))} />)}
          </div>
        )}
      </Card>
    </div>
  );
}
