import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type AdminBookingRow, type AdminBookings, type Booking, type Room } from "@/lib/api";
import { Badge, Button, Card, PageHeader, Skeleton, fieldCompact, fieldLabel } from "@/components/ui";
import BookingDialog from "@/components/BookingDialog";
import { addDays, fmtDay, hm, todayStr, ymd } from "@/lib/time";

// Booking history for admins, up to a year back. Past rows are read-only; a booking still to come can be opened to edit or cancel.
export default function Bookings() {
  const today = todayStr();
  const [f, setF] = useState({ from: addDays(today, -30), to: addDays(today, 30), roomId: "", q: "" });
  const [applied, setApplied] = useState(f);
  const [editing, setEditing] = useState<Booking | null>(null);
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: () => api<Room[]>("/rooms") });
  const qs = new URLSearchParams({ from: applied.from, to: applied.to, ...(applied.roomId ? { roomId: applied.roomId } : {}), ...(applied.q ? { q: applied.q } : {}) }).toString();
  const data = useQuery({ queryKey: ["admin-bookings", qs], queryFn: () => api<AdminBookings>(`/admin/bookings?${qs}`) });
  const oldest = addDays(today, -366);
  const open = (r: AdminBookingRow) => setEditing({ id: r.id, roomId: r.roomId, startsAt: r.startsAt, endsAt: r.endsAt, mine: false, canEdit: true, title: r.title, bookedFor: r.bookedFor, notes: r.notes, owner: r.owner });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Booking history" subtitle="Every room booking, up to one year back." />
      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setApplied(f); }}>
          <div><label className={fieldLabel} htmlFor="bh-from">From</label><input id="bh-from" type="date" min={oldest} max={f.to} className={`${fieldCompact} w-40`} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
          <div><label className={fieldLabel} htmlFor="bh-to">To</label><input id="bh-to" type="date" min={f.from} className={`${fieldCompact} w-40`} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
          <div><label className={fieldLabel} htmlFor="bh-room">Room</label><select id="bh-room" className={`${fieldCompact} w-40`} value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}><option value="">All rooms</option>{rooms.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
          <div><label className={fieldLabel} htmlFor="bh-q">Search</label><input id="bh-q" className={`${fieldCompact} w-56`} placeholder="Title, person, notes…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
          <Button type="submit">Show</Button>
          <Button type="button" variant="outline" className="h-9" onClick={() => { const d = { from: addDays(today, -366), to: today, roomId: f.roomId, q: f.q }; setF(d); setApplied(d); }}>Last year</Button>
        </form>
      </Card>
      {data.isLoading ? <Skeleton className="h-48" /> : data.isError ? <p role="alert" className="text-sm text-[var(--danger)]">{data.error.message}</p> : (
        <>
          <p className="text-sm text-[var(--ink-soft)]">{data.data!.rows.length} booking{data.data!.rows.length === 1 ? "" : "s"}{data.data!.truncated ? " shown (there are more: narrow the dates or the room)" : ""}.</p>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wide text-[var(--ink-mute)]"><th className="px-4 py-2 font-medium">When</th><th className="px-4 py-2 font-medium">Room</th><th className="px-4 py-2 font-medium">Title</th><th className="px-4 py-2 font-medium">Booked by</th><th className="px-4 py-2"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.data!.rows.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--line)] last:border-0 align-top">
                    <td className="tnum whitespace-nowrap px-4 py-2">{fmtDay(ymd(r.startsAt), { weekday: "short", day: "numeric", month: "short", year: "numeric" })}<div className="text-xs text-[var(--ink-mute)]">{hm(r.startsAt)} – {hm(r.endsAt)}</div></td>
                    <td className="px-4 py-2">{r.room}</td>
                    <td className="px-4 py-2">{r.title}{r.bookedFor && <div className="text-xs text-[var(--ink-mute)]">for {r.bookedFor}</div>}{r.notes && <div className="text-xs text-[var(--ink-mute)]">{r.notes}</div>}</td>
                    <td className="px-4 py-2">{r.owner}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">{r.past ? <Badge>Past</Badge> : <Button variant="outline" onClick={() => open(r)}>Edit</Button>}</td>
                  </tr>
                ))}
                {!data.data!.rows.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--ink-mute)]">No bookings match.</td></tr>}
              </tbody>
            </table>
          </Card>
        </>
      )}
      {editing && rooms.data && <BookingDialog rooms={rooms.data} booking={editing} onClose={() => { setEditing(null); data.refetch(); }} />}
    </div>
  );
}
