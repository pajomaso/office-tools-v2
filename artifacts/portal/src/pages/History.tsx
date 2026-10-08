import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type MyBookings, type Booking, type Room } from "@/lib/api";
import { Button, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { fmtDay, hm, ymd } from "@/lib/time";

function Row({ title, sub, color, day, time, note, onCancel }: { title: string; sub: string; color?: string; day: string; time?: string; note?: string; onCancel?: () => void }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="size-2 shrink-0 rounded-full" style={{ background: color ?? "var(--brand)" }} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="text-xs text-[var(--ink-mute)]">{sub}</div>
          {note && <div className="mt-0.5 truncate text-xs text-[var(--ink-soft)]">{note}</div>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <div className="tnum text-right text-xs text-[var(--ink-soft)]"><div>{day}</div>{time && <div>{time}</div>}</div>
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
      </div>
    </li>
  );
}

export default function History() {
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ["my-bookings"], queryFn: () => api<MyBookings>("/my-bookings") });
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: () => api<Room[]>("/rooms") });
  const refresh = () => ["my-bookings", "bookings", "summary"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const cancelRoom = useMutation({ mutationFn: (id: string) => api(`/bookings/${id}`, { method: "DELETE" }), onSuccess: refresh });
  const room = (id: string) => rooms.data?.find((r) => r.id === id);
  const roomRow = (b: Booking, cancel: boolean) => (
    <Row key={b.id} title={b.title ?? ""} sub={`${room(b.roomId)?.name} · ${b.attendees} attending`} color={room(b.roomId)?.color} note={b.notes}
      day={fmtDay(ymd(b.startsAt), { weekday: "short", day: "numeric", month: "short" })} time={`${hm(b.startsAt)} – ${hm(b.endsAt)}`}
      onCancel={cancel ? () => confirm(`Cancel “${b.title}”?`) && cancelRoom.mutate(b.id) : undefined} />
  );
  const err = cancelRoom.error;
  const m = mine.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My bookings" subtitle="Past + upcoming meeting room reservations." />
      {mine.isLoading || !m ? <Skeleton className="h-40" /> : (
        <>
          <section>
            <h2 className="mb-3 text-sm font-semibold">Upcoming</h2>
            {m.upcoming.length ? (
              <ul className="flex flex-col gap-2">
                {m.upcoming.map((b) => roomRow(b, true))}
              </ul>
            ) : <EmptyState title="No upcoming reservations" />}
            {err && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{err.message}</p>}
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold">Past</h2>
            {m.past.length ? (
              <ul className="flex flex-col gap-2">
                {m.past.map((b) => roomRow(b, false))}
              </ul>
            ) : <EmptyState title="Nothing in the past 6 months" />}
          </section>
        </>
      )}
    </div>
  );
}
