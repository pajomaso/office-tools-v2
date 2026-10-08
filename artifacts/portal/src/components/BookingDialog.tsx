import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, type Booking, type Room } from "@/lib/api";
import { Button, Dialog, fieldInput, fieldLabel } from "@/components/ui";
import { endOptions, hm, startOptions, ymd } from "@/lib/time";

export type Draft = { date: string; start: string; end: string; roomId?: string };
export const refreshBookings = (qc: ReturnType<typeof useQueryClient>) => ["bookings", "my-bookings"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

// Create a booking (draft) or edit/cancel one (booking). Used from Home and from the Rooms page.
export default function BookingDialog({ rooms, draft, booking, note, onClose }: { rooms: Room[]; draft?: Draft; booking?: Booking; note?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const editing = !!booking;
  const [title, setTitle] = useState(booking?.title ?? "");
  const [roomId, setRoomId] = useState(booking?.roomId ?? draft?.roomId ?? rooms[0]?.id ?? "");
  const [bookedFor, setBookedFor] = useState(booking?.bookedFor ?? "");
  const [date, setDate] = useState(booking ? ymd(booking.startsAt) : draft!.date);
  const [start, setStart] = useState(booking ? hm(booking.startsAt) : draft!.start);
  const [end, setEnd] = useState(booking ? (hm(booking.endsAt) === "00:00" ? "24:00" : hm(booking.endsAt)) : draft!.end);
  const [notes, setNotes] = useState(booking?.notes ?? "");
  const payload = { roomId, title, bookedFor, notes, date, start, end };
  // A booking made through the API can have an odd time (e.g. 18:28). Keep it selectable so editing never silently changes it.
  const withCurrent = (opts: string[], v: string) => (opts.includes(v) ? opts : [...opts, v].sort());

  const save = useMutation({
    mutationFn: () => editing ? api(`/bookings/${booking.id}`, { method: "PUT", json: payload }) : api("/bookings", { method: "POST", json: payload }),
    onSuccess: () => { refreshBookings(qc); onClose(); },
  });
  const cancel = useMutation({ mutationFn: () => api(`/bookings/${booking!.id}`, { method: "DELETE" }), onSuccess: () => { refreshBookings(qc); onClose(); } });
  const err = save.error ?? cancel.error;

  return (
    <Dialog title={editing ? "Edit reservation" : "New reservation"} description={note ?? "Pick a room, time and add a title. Conflicts are caught on save."} onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div>
          <label className={fieldLabel} htmlFor="bk-title">Meeting title <span className="text-[var(--danger)]">*</span></label>
          <input id="bk-title" className={fieldInput} placeholder="Weekly sync" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={fieldLabel} htmlFor="bk-room">Room</label>
            <select id="bk-room" className={fieldInput} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.seats} seats</option>)}
            </select>
          </div>
          <div>
            <label className={fieldLabel} htmlFor="bk-for">Booked for (optional)</label>
            <input id="bk-for" className={fieldInput} placeholder="Someone else? Say who" value={bookedFor} onChange={(e) => setBookedFor(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={fieldLabel} htmlFor="bk-date">Date</label>
            <input id="bk-date" type="date" required className={fieldInput} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className={fieldLabel} htmlFor="bk-start">Start</label>
            <select id="bk-start" className={fieldInput} value={start} onChange={(e) => setStart(e.target.value)}>{withCurrent(startOptions(), start).map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div>
            <label className={fieldLabel} htmlFor="bk-end">End</label>
            <select id="bk-end" className={fieldInput} value={end} onChange={(e) => setEnd(e.target.value)}>{withCurrent(endOptions(), end).map((t) => <option key={t}>{t}</option>)}</select>
          </div>
        </div>
        <div>
          <label className={fieldLabel} htmlFor="bk-notes">Notes (optional)</label>
          <textarea id="bk-notes" rows={2} className={clsx(fieldInput, "h-auto py-2")} placeholder="Anything we should know — coffee setup, materials, special guests…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <p className="text-xs text-[var(--ink-mute)]">Times are Braga time (Europe/Lisbon).{editing && booking.owner && !booking.mine ? ` Booked by ${booking.owner}.` : ""}</p>
        {err && <p role="alert" className="text-sm text-[var(--danger)]">{err.message}</p>}
        <div className="flex items-center justify-between gap-2">
          <div>{editing && <Button type="button" variant="outline" className="h-9 text-[var(--danger)]" disabled={cancel.isPending} onClick={() => confirm("Cancel this reservation? The room will be free for others.") && cancel.mutate()}>Cancel reservation</Button>}</div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-9" onClick={onClose}>Close</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : editing ? "Save" : "Create"}</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
