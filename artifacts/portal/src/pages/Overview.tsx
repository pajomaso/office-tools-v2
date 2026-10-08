import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Calendar, Plus } from "lucide-react";
import { AnnouncementItem } from "@/pages/Announcements";
import { api, type Announcement, type Booking, type Me, type Room, type Summary } from "@/lib/api";
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

export default function Overview({ me }: { me: Me }) {
  const today = todayStr();
  const news = useQuery({ queryKey: ["announcements"], queryFn: () => api<Announcement[]>("/announcements") });
  const summary = useQuery({ queryKey: ["summary"], queryFn: () => api<Summary>("/summary") });
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: () => api<Room[]>("/rooms") });
  const from = lisbonToUtc(today, "00:00").toISOString(), to = lisbonToUtc(addDays(today, 1), "00:00").toISOString();
  const bookings = useQuery({ queryKey: ["bookings", "today", from], queryFn: () => api<Booking[]>(`/bookings?from=${from}&to=${to}`) });
  const roomName = (id: string) => rooms.data?.find((r) => r.id === id)?.name ?? "Room";
  const s = summary.data;
  const nothing = s && !s.upcoming.length;

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

      <div className="grid gap-4">
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Your upcoming reservations</h2>
            <Link href="/app/history" className="text-xs font-medium text-[var(--brand)] hover:underline">See all →</Link>
          </div>
          {summary.isLoading ? <Skeleton className="h-40" /> : nothing ? (
            <EmptyState icon={<Calendar className="size-5" />} title="Nothing booked yet" body="Reserve a meeting room to get started."
              action={<LinkButton href="/app/book"><Plus className="size-3.5" />Book your first room</LinkButton>} />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--line)]">
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
