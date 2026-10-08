import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import clsx from "clsx";
import { api, type Booking, type Desks, type Room } from "@/lib/api";
import { Button, Dialog, PageHeader, Skeleton, fieldInput, fieldLabel } from "@/components/ui";
import { CLOSE, OPEN, addDays, fmtDay, hm, hourOf, isWeekend, lisbonToUtc, mondayOf, nextWorkday, plusHour, timeOptions, todayStr, ymd } from "@/lib/time";

const ROW = 48; // px per hour
type Draft = { date: string; start: string; end: string; roomId?: string };
const refresh = (qc: ReturnType<typeof useQueryClient>) => ["bookings", "my-bookings", "summary", "desks"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

function BookingDialog({ rooms, draft, onClose }: { rooms: Room[]; draft: Draft; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [roomId, setRoomId] = useState(draft.roomId ?? rooms[0]?.id ?? "");
  const [attendees, setAttendees] = useState(2);
  const [date, setDate] = useState(draft.date);
  const [start, setStart] = useState(draft.start);
  const [end, setEnd] = useState(draft.end);
  const [notes, setNotes] = useState("");
  const [alsoDesk, setAlsoDesk] = useState(true);
  const room = rooms.find((r) => r.id === roomId);
  const times = timeOptions();

  const create = useMutation({
    mutationFn: () => api("/bookings", { method: "POST", json: { roomId, title, attendees, notes, date, start, end, alsoDesk } }),
    onSuccess: () => { refresh(qc); onClose(); },
  });

  return (
    <Dialog title="New reservation" description="Pick a room, time and add a title. Conflicts are caught on save." onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
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
            <label className={clsx(fieldLabel, "flex justify-between")} htmlFor="bk-att"><span>Attendees</span><span className="font-normal normal-case">of {room?.seats ?? "–"}</span></label>
            <input id="bk-att" type="number" min={1} max={room?.seats} className={fieldInput} value={attendees} onChange={(e) => setAttendees(Number(e.target.value))} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={fieldLabel} htmlFor="bk-date">Date</label>
            <input id="bk-date" type="date" required className={fieldInput} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className={fieldLabel} htmlFor="bk-start">Start</label>
            <select id="bk-start" className={fieldInput} value={start} onChange={(e) => setStart(e.target.value)}>{times.slice(0, -1).map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div>
            <label className={fieldLabel} htmlFor="bk-end">End</label>
            <select id="bk-end" className={fieldInput} value={end} onChange={(e) => setEnd(e.target.value)}>{times.slice(1).map((t) => <option key={t}>{t}</option>)}</select>
          </div>
        </div>
        <div>
          <label className={fieldLabel} htmlFor="bk-notes">Notes (optional)</label>
          <textarea id="bk-notes" rows={2} className={clsx(fieldInput, "h-auto py-2")} placeholder="Anything we should know — coffee setup, materials, special guests…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          <input type="checkbox" checked={alsoDesk} onChange={(e) => setAlsoDesk(e.target.checked)} className="size-4 accent-[var(--brand)]" />
          Also reserve a desk seat that day
        </label>
        <p className="text-xs text-[var(--ink-mute)]">Times are Braga time (Europe/Lisbon).</p>
        {create.isError && <p role="alert" className="text-sm text-[var(--danger)]">{create.error.message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-9" onClick={onClose}>Close</Button>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function RoomWeek({ monday, rooms, roomFilter, bookings, onPick }: { monday: string; rooms: Room[]; roomFilter: string; bookings: Booking[]; onPick: (d: Draft) => void }) {
  const days = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
  const today = todayStr();
  const hoursList = Array.from({ length: CLOSE - OPEN }, (_, i) => OPEN + i);
  const color = (id: string) => rooms.find((r) => r.id === id)?.color ?? "#045CFC";
  const name = (id: string) => rooms.find((r) => r.id === id)?.name ?? "";

  return (
    <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)]">
      <div className="grid grid-cols-[56px_repeat(5,1fr)] border-b border-[var(--line)]">
        <div />
        {days.map((d) => (
          <div key={d} className={clsx("px-2 py-2 text-center", d === today && "bg-[var(--brand-soft)]")}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-mute)]">{fmtDay(d, { weekday: "short" })}</div>
            <div className="tnum text-sm font-semibold">{fmtDay(d, { day: "2-digit" })}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[56px_repeat(5,1fr)]">
        <div>{hoursList.map((h) => <div key={h} style={{ height: ROW }} className="tnum pr-2 text-right text-[11px] text-[var(--ink-mute)]">{String(h).padStart(2, "0")}:00</div>)}</div>
        {days.map((d) => {
          const dayBookings = bookings.filter((b) => ymd(b.startsAt) === d && (roomFilter === "all" || b.roomId === roomFilter));
          return (
            <div key={d} className={clsx("relative border-l border-[var(--line)]", d === today && "bg-[var(--brand-soft)]/40")}
              style={{ height: ROW * hoursList.length }}
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                const mins = OPEN * 60 + Math.floor((y / ROW) * 2) * 30;
                const start = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
                if (lisbonToUtc(d, start) < new Date()) return;
                onPick({ date: d, start, end: plusHour(start), roomId: roomFilter === "all" ? undefined : roomFilter });
              }}>
              {hoursList.map((h) => <div key={h} style={{ height: ROW }} className="pointer-events-none border-b border-[var(--line)]" />)}
              {dayBookings.map((b) => {
                const top = (hourOf(b.startsAt) - OPEN) * ROW;
                const h = (hourOf(b.endsAt) - hourOf(b.startsAt)) * ROW;
                return (
                  <div key={b.id} title={b.mine ? `${b.title} · ${name(b.roomId)}` : "Reserved"}
                    className={clsx("absolute inset-x-1 overflow-hidden rounded-md border px-1.5 py-1 text-[11px] leading-tight",
                      b.mine ? "border-[color-mix(in_oklch,var(--brand)_50%,transparent)] bg-[color-mix(in_oklch,var(--brand)_14%,var(--surface))] text-[var(--brand-ink)]" : "border-[var(--line-strong)] bg-[var(--surface-2)] text-[var(--ink-mute)]")}
                    style={{ top, height: h - 2, ...(roomFilter === "all" ? { borderLeft: `3px solid ${color(b.roomId)}` } : {}) }}>
                    <div className="truncate font-semibold">{b.mine ? b.title : "Reserved"}</div>
                    <div className="tnum truncate opacity-80">{hm(b.startsAt)}–{hm(b.endsAt)}{roomFilter === "all" ? ` · ${name(b.roomId)}` : ""}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeskWeek({ monday }: { monday: string }) {
  const qc = useQueryClient();
  const from = monday, to = addDays(monday, 4), today = todayStr();
  const desks = useQuery({ queryKey: ["desks", from], queryFn: () => api<Desks>(`/desks?from=${from}&to=${to}`) });
  const toggle = useMutation({
    mutationFn: ({ date, has }: { date: string; has: boolean }) => api(has ? `/desks/${date}` : "/desks", has ? { method: "DELETE" } : { method: "POST", json: { date } }),
    onSuccess: () => refresh(qc),
  });
  if (!desks.data) return <Skeleton className="h-48 w-full" />;
  const cap = desks.data.capacity;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => {
          const d = addDays(monday, i);
          const day = desks.data.days.find((x) => x.date === d);
          const taken = day?.taken ?? 0, mine = !!day?.mine, full = taken >= cap, past = d < today;
          return (
            <div key={d} className={clsx("rounded-[var(--r-lg)] border bg-[var(--surface)] p-3.5", mine ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/20" : "border-[var(--line)]", d === today && "bg-[var(--brand-soft)]/40")}>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-mute)]">{fmtDay(d, { weekday: "short" })}</div>
              <div className="tnum text-lg font-semibold">{fmtDay(d, { day: "2-digit", month: "short" })}</div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full bg-[var(--brand)]" style={{ width: `${Math.min(100, (taken / cap) * 100)}%` }} /></div>
              <div className="tnum mt-1.5 text-xs text-[var(--ink-mute)]">{taken} of {cap} seats taken</div>
              <Button className="mt-3 w-full" variant={mine ? "outline" : "primary"} disabled={past || (!mine && full) || toggle.isPending} onClick={() => toggle.mutate({ date: d, has: mine })}>
                {mine ? "Cancel seat" : full ? "Full" : "Reserve"}
              </Button>
            </div>
          );
        })}
      </div>
      {toggle.isError && <p role="alert" className="text-sm text-[var(--danger)]">{toggle.error.message}</p>}
      <p className="text-xs text-[var(--ink-mute)]">A seat is for the day, not a specific desk. Cancel until 10:00 on the day; after that it counts as a used day.</p>
    </div>
  );
}

export default function Book() {
  const [tab, setTab] = useState<"rooms" | "desks">("rooms");
  const [week, setWeek] = useState(() => mondayOf(nextWorkday(todayStr())));
  const [roomFilter, setRoomFilter] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: () => api<Room[]>("/rooms") });
  const from = lisbonToUtc(week, "00:00").toISOString(), to = lisbonToUtc(addDays(week, 5), "00:00").toISOString();
  const bookings = useQuery({ queryKey: ["bookings", from], queryFn: () => api<Booking[]>(`/bookings?from=${from}&to=${to}`), enabled: tab === "rooms" });

  const filter = roomFilter ?? rooms.data?.[0]?.id ?? "all";
  const thisWeek = mondayOf(nextWorkday(todayStr()));
  const defaultDraft = useMemo<Draft>(() => {
    const t = todayStr(), now = new Date();
    const hourNow = Number(hm(now).slice(0, 2));
    const useToday = !isWeekend(t) && hourNow < CLOSE - 1;
    const date = useToday ? t : nextWorkday(addDays(t, 1));
    const start = useToday ? `${String(Math.max(OPEN, hourNow + 1)).padStart(2, "0")}:00` : "09:00";
    return { date, start, end: plusHour(start), roomId: filter === "all" ? undefined : filter };
  }, [filter]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Book a room" subtitle="Pick a free slot on the calendar. Other clients' bookings are anonymised."
        actions={<Button onClick={() => setDraft(defaultDraft)} disabled={!rooms.data?.length}><Plus className="size-4" />New reservation</Button>} />

      <div className="flex gap-1 self-start rounded-lg bg-[var(--surface-2)] p-1" role="tablist">
        {(["rooms", "desks"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={clsx("rounded-md px-3 py-1 text-sm font-medium cursor-pointer", tab === t ? "bg-[var(--surface)] shadow-[var(--shadow-sm)]" : "text-[var(--ink-soft)]")}>
            {t === "rooms" ? "Meeting rooms" : "Desks"}
          </button>
        ))}
      </div>

      {tab === "rooms" && (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setRoomFilter("all")}
            className={clsx("w-44 rounded-[var(--r-lg)] border bg-[var(--surface)] px-3 py-3 text-left transition-all cursor-pointer", filter === "all" ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/30 shadow-[var(--shadow-md)]" : "border-[var(--line)] hover:border-[var(--line-strong)]")}>
            <div className="text-sm font-semibold">All rooms</div>
            <div className="mt-0.5 text-xs text-[var(--ink-mute)]">Show every reservation side by side</div>
          </button>
          {rooms.data?.map((r) => (
            <button key={r.id} type="button" onClick={() => setRoomFilter(r.id)}
              className={clsx("flex w-44 flex-col overflow-hidden rounded-[var(--r-lg)] border bg-[var(--surface)] text-left transition-all cursor-pointer", filter === r.id ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/30 shadow-[var(--shadow-md)]" : "border-[var(--line)] hover:border-[var(--line-strong)]")}>
              <div className="relative aspect-[4/3] w-full" style={{ backgroundColor: `color-mix(in oklch, ${r.color} 14%, var(--surface))` }}>
                <span className="absolute top-2 left-2 size-2.5 rounded-full" style={{ background: r.color }} />
              </div>
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm font-semibold">{r.name}</span>
                <span className="flex items-center gap-1 text-xs text-[var(--ink-mute)]"><Users className="size-3" />{r.seats}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" aria-label="Previous week" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft className="size-4" /></Button>
            <Button variant="ghost" aria-label="Next week" onClick={() => setWeek(addDays(week, 7))}><ChevronRight className="size-4" /></Button>
          </div>
          <Button variant="outline" onClick={() => setWeek(thisWeek)}>This week</Button>
        </div>
        <div className="tnum text-sm text-[var(--ink-soft)]">{fmtDay(week, { day: "2-digit", month: "short" })} – {fmtDay(addDays(week, 4), { day: "2-digit", month: "short" })}{week === thisWeek && <span className="ml-2 text-[var(--brand)]">· current week</span>}</div>
      </div>

      {tab === "rooms" ? (
        <>
          {rooms.data && bookings.data ? <RoomWeek monday={week} rooms={rooms.data} roomFilter={filter} bookings={bookings.data} onPick={setDraft} /> : <Skeleton className="h-[600px] w-full" />}
          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--ink-mute)]">
            <span className="inline-flex items-center gap-1.5"><span className="block size-3 rounded-sm border border-[color-mix(in_oklch,var(--brand)_50%,transparent)] bg-[color-mix(in_oklch,var(--brand)_14%,var(--surface))]" />Your bookings</span>
            <span className="inline-flex items-center gap-1.5"><span className="block size-3 rounded-sm border border-[var(--line-strong)] bg-[var(--surface-2)]" />Reserved (someone else)</span>
            <span className="ml-auto">Click an empty slot to book</span>
          </div>
        </>
      ) : <DeskWeek monday={week} />}

      {draft && rooms.data && <BookingDialog rooms={rooms.data} draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}
