import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pencil, Plus, Users } from "lucide-react";
import clsx from "clsx";
import { api, type Area, type Block, type Booking, type Me, type MyBookings, type Room } from "@/lib/api";
import { Button, Dialog, PageHeader, Skeleton, fieldInput, fieldLabel } from "@/components/ui";
import BookingDialog, { type Draft } from "@/components/BookingDialog";
import RoomPhoto from "@/components/RoomPhoto";
import EditRoomDialog from "@/components/EditRoomDialog";
import { addDays, endOptions, fmtDay, hm, hourOf, lisbonToUtc, mondayOf, plusHour, startOptions, todayStr, ymd } from "@/lib/time";
import { askConfirm } from "@/components/Confirm";

const ROW = 36; // px per hour; the grid shows all 24 hours and opens scrolled to 08:00
const blockLabel = { cleaning: "Cleaning", maintenance: "Maintenance" } as const;

// ── Admin: cleaning / maintenance slot ──────────────────────────────────────
function BlockDialog({ rooms, onClose }: { rooms: Room[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ kind: "cleaning", roomId: "all", title: "", date: todayStr(), start: "07:00", end: "08:00" });
  const save = useMutation({ mutationFn: () => api("/admin/blocks", { method: "POST", json: f }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["blocks"] }); onClose(); } });
  return (
    <Dialog title="Cleaning or maintenance slot" description="Shown on the calendar. Rooms can't be booked during it." onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={fieldLabel} htmlFor="bl-kind">Type</label><select id="bl-kind" className={fieldInput} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="cleaning">Cleaning</option><option value="maintenance">Maintenance</option></select></div>
          <div><label className={fieldLabel} htmlFor="bl-room">Room</label><select id="bl-room" className={fieldInput} value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}><option value="all">All rooms</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        </div>
        <div><label className={fieldLabel} htmlFor="bl-title">Note (optional)</label><input id="bl-title" className={fieldInput} maxLength={100} placeholder="Weekly cleaning" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={fieldLabel} htmlFor="bl-date">Date</label><input id="bl-date" type="date" required className={fieldInput} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div><label className={fieldLabel} htmlFor="bl-start">Start</label><select id="bl-start" className={fieldInput} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })}>{startOptions().map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label className={fieldLabel} htmlFor="bl-end">End</label><select id="bl-end" className={fieldInput} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })}>{endOptions().map((t) => <option key={t}>{t}</option>)}</select></div>
        </div>
        {save.isError && <p role="alert" className="text-sm text-[var(--danger)]">{save.error.message}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" className="h-9" onClick={onClose}>Close</Button><Button type="submit" disabled={save.isPending}>Add</Button></div>
      </form>
    </Dialog>
  );
}

// ── Calendar ────────────────────────────────────────────────────────────────
function Calendar({ week, rooms, filter, bookings, blocks, me, onPick, onEdit, onBlock }: {
  week: string; rooms: Room[]; filter: string; bookings: Booking[]; blocks: Block[]; me: Me;
  onPick: (d: Draft) => void; onEdit: (b: Booking) => void; onBlock: (b: Block) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const today = todayStr();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = 8 * ROW; }, []);
  const color = (id: string) => rooms.find((r) => r.id === id)?.color ?? "#045CFC";
  const name = (id: string) => rooms.find((r) => r.id === id)?.name ?? "";
  const place = (s: string, e: string) => ({ top: hourOf(s) * ROW, height: Math.max(14, ((+new Date(e) - +new Date(s)) / 3_600_000) * ROW - 2) });

  return (
    <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)]">
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-[var(--line)]">
        <div />
        {days.map((d) => (
          <div key={d} className={clsx("px-1 py-2 text-center", d === today && "bg-[var(--brand-soft)]")}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-mute)]">{fmtDay(d, { weekday: "short" })}</div>
            <div className="tnum text-sm font-semibold">{fmtDay(d, { day: "2-digit" })}</div>
          </div>
        ))}
      </div>
      <div ref={scroller} className="max-h-[560px] overflow-y-auto" aria-label="Calendar, scrollable through the whole day">
        <div className="grid grid-cols-[48px_repeat(7,1fr)]">
          <div>{Array.from({ length: 24 }, (_, h) => <div key={h} style={{ height: ROW }} className="tnum pr-1.5 text-right text-[10px] text-[var(--ink-mute)]">{String(h).padStart(2, "0")}:00</div>)}</div>
          {days.map((d) => (
            <div key={d} className={clsx("relative border-l border-[var(--line)]", d === today && "bg-[var(--brand-soft)]/40")} style={{ height: ROW * 24 }}
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                const mins = Math.min(23 * 60 + 30, Math.floor((y / ROW) * 2) * 30);
                const start = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
                if (lisbonToUtc(d, start) < new Date()) return;
                onPick({ date: d, start, end: plusHour(start), roomId: filter === "all" ? undefined : filter });
              }}>
              {Array.from({ length: 24 }, (_, h) => <div key={h} style={{ height: ROW }} className={clsx("pointer-events-none border-b", h === 7 || h === 19 ? "border-[var(--line-strong)]" : "border-[var(--line)]")} />)}
              {blocks.filter((b) => ymd(b.startsAt) === d && (filter === "all" || !b.roomId || b.roomId === filter)).map((b) => (
                <button key={b.id} type="button" disabled={me.role !== "admin"} onClick={() => askConfirm(`Remove this ${b.kind} slot?`).then((ok) => ok && onBlock(b))} style={place(b.startsAt, b.endsAt)}
                  className="absolute inset-x-0.5 overflow-hidden rounded-md border border-dashed border-[var(--line-strong)] bg-[repeating-linear-gradient(135deg,var(--surface-2),var(--surface-2)_6px,transparent_6px,transparent_12px)] px-1 text-left text-[10px] font-medium text-[var(--ink-soft)] enabled:cursor-pointer"
                  title={`${blockLabel[b.kind]}${b.title ? ` · ${b.title}` : ""}${b.roomId ? ` · ${name(b.roomId)}` : " · all rooms"}`}>{blockLabel[b.kind]}</button>
              ))}
              {bookings.filter((b) => ymd(b.startsAt) === d && (filter === "all" || b.roomId === filter)).map((b) => (
                <button key={b.id} type="button" disabled={!b.canEdit} onClick={() => onEdit(b)} style={{ ...place(b.startsAt, b.endsAt), ...(filter === "all" ? { borderLeft: `3px solid ${color(b.roomId)}` } : {}) }}
                  className={clsx("absolute inset-x-0.5 overflow-hidden rounded-md border px-1 py-0.5 text-left text-[10px] leading-tight enabled:cursor-pointer",
                    b.mine ? "border-[color-mix(in_oklch,var(--brand)_50%,transparent)] bg-[color-mix(in_oklch,var(--brand)_14%,var(--surface))] text-[var(--brand-ink)]" : "border-[var(--line-strong)] bg-[var(--surface-2)] text-[var(--ink-mute)]")}
                  title={b.canEdit ? `${b.title} · ${name(b.roomId)}${b.bookedFor ? ` · for ${b.bookedFor}` : ""} · ${b.owner}` : `Reserved by ${b.owner} · ${name(b.roomId)}`}>
                  <div className="truncate font-semibold">{b.canEdit ? b.title : b.owner}</div>
                  <div className="tnum truncate opacity-80">{hm(b.startsAt)}–{hm(b.endsAt)}{filter === "all" ? ` · ${name(b.roomId)}` : ""}</div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BookingList({ bookings, blocks, rooms, filter, onEdit }: { bookings: Booking[]; blocks: Block[]; rooms: Room[]; filter: string; onEdit: (b: Booking) => void }) {
  type Entry = { key: string; at: string; end: string; room: string; roomColor?: string; text: string; sub?: string; booking?: Booking };
  const room = (id: string | null) => rooms.find((r) => r.id === id);
  const entries: Entry[] = [
    ...bookings.filter((b) => filter === "all" || b.roomId === filter).map((b) => ({ key: b.id, at: b.startsAt, end: b.endsAt, room: room(b.roomId)?.name ?? "", roomColor: room(b.roomId)?.color, text: b.canEdit ? (b.title ?? "") : "Reserved", sub: [b.bookedFor ? `for ${b.bookedFor}` : "", b.owner && !b.mine ? `by ${b.owner}` : ""].filter(Boolean).join(" · ") || undefined, booking: b })),
    ...blocks.filter((b) => filter === "all" || !b.roomId || b.roomId === filter).map((b) => ({ key: b.id, at: b.startsAt, end: b.endsAt, room: b.roomId ? room(b.roomId)?.name ?? "" : "All rooms", text: blockLabel[b.kind], sub: b.title })),
  ].sort((a, b) => +new Date(a.at) - +new Date(b.at));
  if (!entries.length) return <p className="rounded-[var(--r-lg)] border border-dashed border-[var(--line-strong)] px-6 py-10 text-center text-sm text-[var(--ink-mute)]">Nothing booked this week.</p>;
  let last = "";
  return (
    <ul className="rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)]">
      {entries.map((e) => {
        const day = ymd(e.at), head = day !== last; last = day;
        return (
          <li key={e.key}>
            {head && <div className="border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-1.5 text-xs font-semibold">{fmtDay(day, { weekday: "long", day: "numeric", month: "long" })}</div>}
            <button type="button" disabled={!e.booking?.canEdit} onClick={() => e.booking && onEdit(e.booking)} className="flex w-full items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5 text-left last:border-0 enabled:hover:bg-[var(--surface-2)] enabled:cursor-pointer">
              <span className="flex min-w-0 items-center gap-2.5"><span className="size-2 shrink-0 rounded-full" style={{ background: e.roomColor ?? "var(--ink-mute)" }} /><span className="truncate text-sm"><span className="font-medium">{e.room}</span> · {e.text}{e.sub ? <span className="text-[var(--ink-mute)]"> · {e.sub}</span> : null}</span></span>
              <span className="tnum shrink-0 text-xs text-[var(--ink-soft)]">{hm(e.at)} – {hm(e.end)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function MyBookingsView({ rooms, onEdit }: { rooms: Room[]; onEdit: (b: Booking) => void }) {
  const mine = useQuery({ queryKey: ["my-bookings"], queryFn: () => api<MyBookings>("/my-bookings") });
  const row = (b: Booking, past: boolean) => (
    <li key={b.id} className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5 last:border-0">
      <div className="min-w-0"><div className="truncate text-sm font-semibold">{b.title}{b.bookedFor ? <span className="font-normal text-[var(--ink-mute)]"> · for {b.bookedFor}</span> : null}</div><div className="text-xs text-[var(--ink-mute)]">{rooms.find((r) => r.id === b.roomId)?.name}</div></div>
      <div className="flex shrink-0 items-center gap-3"><div className="tnum text-right text-xs text-[var(--ink-soft)]"><div>{fmtDay(ymd(b.startsAt), { weekday: "short", day: "numeric", month: "short" })}</div><div>{hm(b.startsAt)} – {hm(b.endsAt)}</div></div>{!past && <Button variant="outline" onClick={() => onEdit(b)}>Edit</Button>}</div>
    </li>
  );
  if (mine.isLoading) return <Skeleton className="h-32" />;
  return (
    <div className="flex flex-col gap-6">
      <section><h2 className="mb-2 text-sm font-semibold">Upcoming</h2>{mine.data?.upcoming.length ? <ul className="rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)]">{mine.data.upcoming.map((b) => row(b, false))}</ul> : <p className="text-sm text-[var(--ink-mute)]">No upcoming reservations.</p>}</section>
      <section><h2 className="mb-2 text-sm font-semibold">Past (last 6 months)</h2>{mine.data?.past.length ? <ul className="rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)]">{mine.data.past.map((b) => row(b, true))}</ul> : <p className="text-sm text-[var(--ink-mute)]">Nothing yet.</p>}</section>
    </div>
  );
}

export default function Rooms({ me }: { me: Me }) {
  const qc = useQueryClient();
  const [view, setView] = useState<"calendar" | "list" | "mine">("calendar");
  const [week, setWeek] = useState(() => mondayOf(todayStr()));
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [addBlock, setAddBlock] = useState(false);
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: () => api<Room[]>("/rooms") });
  const area = useQuery({ queryKey: ["area"], queryFn: () => api<Area>("/area") });
  const from = lisbonToUtc(week, "00:00").toISOString(), to = lisbonToUtc(addDays(week, 7), "00:00").toISOString();
  const bookings = useQuery({ queryKey: ["bookings", from], queryFn: () => api<Booking[]>(`/bookings?from=${from}&to=${to}`), enabled: view !== "mine" });
  const blocks = useQuery({ queryKey: ["blocks", from], queryFn: () => api<Block[]>(`/blocks?from=${from}&to=${to}`), enabled: view !== "mine" });
  const delBlock = useMutation({ mutationFn: (id: string) => api(`/admin/blocks/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["blocks"] }) });
  const thisWeek = mondayOf(todayStr());
  const quick = () => { const h = Number(hm(new Date()).slice(0, 2)); const start = h >= 23 ? "23:00" : `${String(h + 1).padStart(2, "0")}:00`; setDraft({ date: todayStr(), start, end: plusHour(start), roomId: filter === "all" ? undefined : filter }); };
  const R = rooms.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Rooms" subtitle={area.data?.bookingNote ?? "Use it wisely. If you cancel, others can use the room."}
        actions={<>{me.role === "admin" && <Button variant="outline" onClick={() => setAddBlock(true)}>Cleaning / maintenance</Button>}<Button onClick={quick} disabled={!R.length}><Plus className="size-4" />New reservation</Button></>} />

      <div className="grid grid-cols-3 gap-3">
        <button type="button" onClick={() => setFilter("all")} className={clsx("col-span-3 w-full rounded-[var(--r-lg)] border bg-[var(--surface)] px-3 py-3 text-left transition-all cursor-pointer", filter === "all" ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/30" : "border-[var(--line)] hover:border-[var(--line-strong)]")}>
          <div className="text-sm font-semibold">All rooms <span className="font-normal text-[var(--ink-mute)]">· side by side</span></div>
        </button>
        {R.map((r) => (
          <div key={r.id} className={clsx("relative min-w-0 overflow-hidden rounded-[var(--r-lg)] border bg-[var(--surface)] transition-all", filter === r.id ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/30" : "border-[var(--line)] hover:border-[var(--line-strong)]")}>
            <button type="button" onClick={() => setFilter(r.id)} className="block w-full text-left cursor-pointer">
              <RoomPhoto room={r} className="aspect-[16/9] w-full" />
              <div className="flex items-center justify-between px-3 py-2"><span className="text-sm font-semibold">{r.name}</span><span className="flex items-center gap-1 text-xs text-[var(--ink-mute)]"><Users className="size-3" />{r.seats}</span></div>
            </button>
            {me.role === "admin" && <button type="button" aria-label={`Edit ${r.name}`} onClick={() => setEditRoom(r)} className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-[var(--surface)]/90 text-[var(--ink-soft)] shadow-[var(--shadow-sm)] hover:text-[var(--ink)] cursor-pointer"><Pencil className="size-3" /></button>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-[var(--surface-2)] p-1" role="tablist">
          {([["calendar", "Calendar"], ["list", "List"], ["mine", "My bookings"]] as const).map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={clsx("rounded-md px-3 py-1 text-sm font-medium cursor-pointer", view === v ? "bg-[var(--surface)] shadow-[var(--shadow-sm)]" : "text-[var(--ink-soft)]")}>{l}</button>
          ))}
        </div>
        {view !== "mine" && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1"><Button variant="ghost" aria-label="Previous week" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft className="size-4" /></Button><Button variant="ghost" aria-label="Next week" onClick={() => setWeek(addDays(week, 7))}><ChevronRight className="size-4" /></Button></div>
            <Button variant="outline" onClick={() => setWeek(thisWeek)}>This week</Button>
            <div className="tnum text-sm text-[var(--ink-soft)]">{fmtDay(week, { day: "2-digit", month: "short" })} – {fmtDay(addDays(week, 6), { day: "2-digit", month: "short" })}{week === thisWeek && <span className="ml-2 text-[var(--brand)]">· this week</span>}</div>
          </div>
        )}
      </div>

      {view === "mine" ? <MyBookingsView rooms={R} onEdit={setEditing} /> : !rooms.data || !bookings.data || !blocks.data ? <Skeleton className="h-[560px] w-full" /> : view === "calendar" ? (
        <>
          <Calendar week={week} rooms={R} filter={filter} bookings={bookings.data} blocks={blocks.data} me={me} onPick={setDraft} onEdit={setEditing} onBlock={(b) => delBlock.mutate(b.id)} />
          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--ink-mute)]">
            <span className="inline-flex items-center gap-1.5"><span className="block size-3 rounded-sm border border-[color-mix(in_oklch,var(--brand)_50%,transparent)] bg-[color-mix(in_oklch,var(--brand)_14%,var(--surface))]" />Your bookings</span>
            <span className="inline-flex items-center gap-1.5"><span className="block size-3 rounded-sm border border-[var(--line-strong)] bg-[var(--surface-2)]" />Reserved (someone else)</span>
            <span className="inline-flex items-center gap-1.5"><span className="block size-3 rounded-sm border border-dashed border-[var(--line-strong)] bg-[repeating-linear-gradient(135deg,var(--surface-2),var(--surface-2)_3px,transparent_3px,transparent_6px)]" />Cleaning / maintenance</span>
            <span className="ml-auto">Open 24/7 · scroll for the rest of the day · click an empty slot to book</span>
          </div>
        </>
      ) : <BookingList bookings={bookings.data} blocks={blocks.data} rooms={R} filter={filter} onEdit={setEditing} />}

      {draft && <BookingDialog rooms={R} draft={draft} note={area.data?.bookingNote} onClose={() => setDraft(null)} />}
      {editing && <BookingDialog rooms={R} booking={editing} onClose={() => setEditing(null)} />}
      {editRoom && <EditRoomDialog room={editRoom} onClose={() => setEditRoom(null)} />}
      {addBlock && <BlockDialog rooms={R} onClose={() => setAddBlock(false)} />}
    </div>
  );
}
