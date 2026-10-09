import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Eye, EyeOff, Pencil, Pin, Plus, Trash2, Users } from "lucide-react";
import clsx from "clsx";
import { api, type Area, type Booking, type Item, type Me, type Message, type Messages, type Room } from "@/lib/api";
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, fieldInput, fieldCompact, fieldLabel } from "@/components/ui";
import BookingDialog, { type Draft } from "@/components/BookingDialog";
import RoomPhoto from "@/components/RoomPhoto";
import { itemKind, itemStatus, messageDays } from "@/lib/labels";
import { addDays, fmtDay, hm, lisbonToUtc, plusHour, todayStr, ymd } from "@/lib/time";
import { askConfirm } from "@/components/Confirm";

// ── Messages ────────────────────────────────────────────────────────────────
function MessageRow({ m }: { m: Message }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.body);
  const [days, setDays] = useState(7);
  const refresh = () => qc.invalidateQueries({ queryKey: ["messages"] });
  const patch = useMutation({ mutationFn: (b: object) => api(`/messages/${m.id}`, { method: "PATCH", json: b }), onSuccess: () => { setEditing(false); refresh(); } });
  const del = useMutation({ mutationFn: () => api(`/messages/${m.id}`, { method: "DELETE" }), onSuccess: refresh });
  const err = patch.error ?? del.error;
  const expired = new Date(m.expiresAt) <= new Date();
  return (
    <li className={clsx("rounded-[var(--r-lg)] border px-4 py-3", m.pinned ? "border-[color-mix(in_oklch,var(--brand)_40%,transparent)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-[var(--surface)]")}>
      {editing ? (
        <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); patch.mutate({ body: text, days }); }}>
          <textarea aria-label="Edit message" rows={2} maxLength={1000} className={clsx(fieldInput, "h-auto py-2")} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-[var(--ink-mute)]" htmlFor={`d-${m.id}`}>Show for</label>
            <select id={`d-${m.id}`} className={`${fieldCompact} w-32`} value={days} onChange={(e) => setDays(Number(e.target.value))}>{messageDays.map(([d, l]) => <option key={d} value={d}>{l}</option>)}</select>
            <span className="text-xs text-[var(--ink-mute)]">from today</span>
            <Button type="submit" disabled={patch.isPending || !text.trim()}>Save</Button>
            <Button type="button" variant="outline" className="h-9" onClick={() => { setEditing(false); setText(m.body); }}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="whitespace-pre-line break-words text-sm">{m.pinned && <Pin className="mr-1 inline size-3.5 text-[var(--brand)]" />}{m.body}</p>
            <p className="mt-1.5 text-[11px] text-[var(--ink-mute)]">
              {m.mine ? "You" : m.author} · {fmtDay(ymd(m.createdAt), { day: "numeric", month: "short" })}{m.editedAt && " · edited"}
              {!expired && !m.pinned && ` · until ${fmtDay(ymd(m.expiresAt), { day: "numeric", month: "short" })}`}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            {m.canPin && <button aria-label={m.pinned ? "Unpin message" : "Pin message"} onClick={() => patch.mutate({ pinned: !m.pinned })} className="grid size-7 place-items-center rounded-md text-[var(--ink-mute)] hover:bg-[var(--surface-2)] cursor-pointer"><Pin className="size-3.5" /></button>}
            {m.canEdit && <button aria-label="Edit message" onClick={() => setEditing(true)} className="grid size-7 place-items-center rounded-md text-[var(--ink-mute)] hover:bg-[var(--surface-2)] cursor-pointer"><Pencil className="size-3.5" /></button>}
            {m.canDelete && <button aria-label="Delete message" onClick={() => askConfirm("Delete this message?").then((ok) => ok && del.mutate())} className="grid size-7 place-items-center rounded-md text-[var(--danger)] hover:bg-[var(--surface-2)] cursor-pointer"><Trash2 className="size-3.5" /></button>}
          </div>
        </div>
      )}
      {err && <p role="alert" className="mt-1 text-sm text-[var(--danger)]">{err.message}</p>}
    </li>
  );
}

function MessagesSection() {
  const qc = useQueryClient();
  const msgs = useQuery({ queryKey: ["messages"], queryFn: () => api<Messages>("/messages"), refetchInterval: 60_000 });
  const [body, setBody] = useState(""), [days, setDays] = useState(7), [past, setPast] = useState(false), [all, setAll] = useState(false), [compose, setCompose] = useState(false);
  const LIMIT = 3;
  const post = useMutation({ mutationFn: () => api("/messages", { method: "POST", json: { body, days } }), onSuccess: () => { setBody(""); setDays(7); setCompose(false); qc.invalidateQueries({ queryKey: ["messages"] }); } });
  return (
    <section aria-label="Messages">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Messages</h2><Button variant="outline" onClick={() => setCompose(!compose)}><Plus className="size-3.5" />New message</Button></div>
      {compose && <form className="mb-3 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); post.mutate(); }}>
        <label htmlFor="msg-body" className="sr-only">New message</label>
        <textarea id="msg-body" autoFocus rows={2} maxLength={1000} className={clsx(fieldInput, "h-auto py-2")} placeholder="Share something with the office — lunch plans, a heads-up, a lost umbrella…" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="msg-days" className="text-xs text-[var(--ink-mute)]">Show for</label>
          <select id="msg-days" className={`${fieldCompact} w-32`} value={days} onChange={(e) => setDays(Number(e.target.value))}>{messageDays.map(([d, l]) => <option key={d} value={d}>{l}</option>)}</select>
          <Button type="submit" className="ml-auto" disabled={post.isPending || !body.trim()}>{post.isPending ? "Posting…" : "Post"}</Button>
        </div>
        {post.isError && <p role="alert" className="text-sm text-[var(--danger)]">{post.error.message}</p>}
      </form>}
      {msgs.isLoading ? <Skeleton className="h-20" /> : msgs.data?.current.length ? <>
        <ul className="flex flex-col gap-2">{(all ? msgs.data.current : msgs.data.current.slice(0, LIMIT)).map((m) => <MessageRow key={m.id + m.expiresAt} m={m} />)}</ul>
        {msgs.data.current.length > LIMIT && <button type="button" onClick={() => setAll(!all)} className="mt-2 text-xs font-medium text-[var(--brand)] hover:underline cursor-pointer">{all ? "Show fewer" : `Show all current messages (${msgs.data.current.length})`}</button>}
      </> : <p className="text-sm text-[var(--ink-mute)]">No messages right now.</p>}
      {!!msgs.data?.past.length && (
        <div className="mt-3">
          <button type="button" onClick={() => setPast(!past)} className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--brand)] hover:underline cursor-pointer">{past ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}{past ? "Hide" : "Show"} past messages ({msgs.data.past.length})</button>
          {past && <ul className="mt-2 flex flex-col gap-2 opacity-80">{msgs.data.past.map((m) => <MessageRow key={m.id} m={m} />)}</ul>}
        </div>
      )}
    </section>
  );
}

// ── Issues and requests ─────────────────────────────────────────────────────
function ItemRow({ i }: { i: Item }) {
  const qc = useQueryClient();
  const follow = useMutation({
    mutationFn: () => api(`/items/${i.id}/follow`, { method: i.following ? "DELETE" : "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });
  return (
    <li className="rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{itemKind[i.kind]}</Badge>
            {i.visibility === "private" && <Badge>Private</Badge>}
            <span className="text-sm font-semibold">{i.title}</span>
          </div>
          {i.body && <p className="mt-1 whitespace-pre-line text-xs text-[var(--ink-soft)]">{i.body}</p>}
          <p className="mt-1.5 text-[11px] text-[var(--ink-mute)]">
            {i.mine ? "You" : i.author} · {fmtDay(ymd(i.createdAt), { day: "numeric", month: "short" })} ·{" "}
            {i.claimedByName ? <>handled by <span className="font-medium text-[var(--ink-soft)]">{i.claimedByName}</span></> : "nobody has picked this up yet"}
          </p>
          {i.statusNote && <p className="mt-1.5 rounded-md bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--ink-soft)]">{i.statusNote}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge tone={i.status === "open" ? "neutral" : "brand"}>{itemStatus[i.status]}</Badge>
          {i.visibility === "public" && !i.mine && <button type="button" disabled={follow.isPending} onClick={() => follow.mutate()} className="text-xs font-medium text-[var(--brand)] hover:underline cursor-pointer">{i.following ? "Following ✓" : "Follow"}</button>}
        </div>
      </div>
    </li>
  );
}

function ItemsSection({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ["items"], queryFn: () => api<Item[]>("/items"), refetchInterval: 60_000 });
  const [f, setF] = useState({ title: "", body: "", kind: "issue", visibility: "public" });
  const send = useMutation({ mutationFn: () => api("/items", { method: "POST", json: f }), onSuccess: () => { setF({ title: "", body: "", kind: "issue", visibility: "public" }); setOpen(false); qc.invalidateQueries({ queryKey: ["items"] }); } });
  const active = items.data?.filter((i) => i.status !== "done") ?? [];
  const followed = active.filter((i) => i.following);
  return (
    <section aria-label="Open issues and requests">
      <h2 className="mb-2 text-sm font-semibold">Public and my open issues and requests</h2>
      {open && (
        <Card className="mb-3 p-4">
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={fieldLabel} htmlFor="it-kind">Type</label><select id="it-kind" className={fieldInput} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="issue">Issue (something is broken)</option><option value="request">Request (I need something)</option></select></div>
              <div><label className={fieldLabel} htmlFor="it-vis">Who can see it</label><select id="it-vis" className={fieldInput} value={f.visibility} onChange={(e) => setF({ ...f, visibility: e.target.value })}><option value="public">Everyone</option><option value="private">Only me and the admins</option></select></div>
            </div>
            <div><label className={fieldLabel} htmlFor="it-title">Title</label><input id="it-title" required autoFocus maxLength={140} className={fieldInput} placeholder={f.kind === "issue" ? "Projector in Alfa won't turn on" : "More coffee capsules"} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><label className={fieldLabel} htmlFor="it-body">Details (optional)</label><textarea id="it-body" rows={2} maxLength={2000} className={clsx(fieldInput, "h-auto py-2")} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
            {send.isError && <p role="alert" className="text-sm text-[var(--danger)]">{send.error.message}</p>}
            <div className="flex gap-2"><Button type="submit" disabled={send.isPending || !f.title.trim()}>{send.isPending ? "Sending…" : "Send"}</Button><Button type="button" variant="outline" className="h-9" onClick={() => setOpen(false)}>Close</Button></div>
          </form>
        </Card>
      )}
      {items.isLoading ? <Skeleton className="h-20" /> : active.length ? (
        <>
          {!!followed.length && <p className="mb-2 text-xs text-[var(--ink-mute)]">You're following {followed.length} of these.</p>}
          <ul className="flex flex-col gap-2">{[...followed, ...active.filter((i) => !i.following)].map((i) => <ItemRow key={i.id + i.updatedAt} i={i} />)}</ul>
        </>
      ) : <p className="text-sm text-[var(--ink-mute)]">Nothing open. Everything has been taken care of.</p>}
    </section>
  );
}

// ── Rooms + today's bookings ────────────────────────────────────────────────
export default function Home({ me }: { me: Me }) {
  const today = todayStr();
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: () => api<Room[]>("/rooms") });
  const area = useQuery({ queryKey: ["area"], queryFn: () => api<Area>("/area") });
  const from = lisbonToUtc(today, "00:00").toISOString(), to = lisbonToUtc(addDays(today, 1), "00:00").toISOString();
  const bookings = useQuery({ queryKey: ["bookings", "today", from], queryFn: () => api<Booking[]>(`/bookings?from=${from}&to=${to}`), refetchInterval: 60_000 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [newItem, setNewItem] = useState(false);
  const now = new Date();
  const room = (id: string) => rooms.data?.find((r) => r.id === id);
  const bookNow = (roomId?: string) => {
    const h = Number(hm(now).slice(0, 2));
    const start = h >= 23 ? "23:00" : `${String(h + 1).padStart(2, "0")}:00`;
    setDraft({ date: today, start, end: plusHour(start), roomId });
  };
  const statusOf = (r: Room) => {
    const mine = (bookings.data ?? []).filter((b) => b.roomId === r.id).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    const busy = mine.find((b) => new Date(b.startsAt) <= now && new Date(b.endsAt) > now);
    const next = mine.find((b) => new Date(b.startsAt) > now);
    return busy ? { free: false, text: `Busy until ${hm(busy.endsAt)}` } : { free: true, text: next ? `Free until ${hm(next.startsAt)}` : "Free for the rest of the day" };
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={`Hello, ${me.name.split(" ")[0]}`} subtitle={fmtDay(today, { weekday: "long", day: "numeric", month: "long" })} actions={<Button onClick={() => { setNewItem(true); setTimeout(() => document.getElementById("it-title")?.scrollIntoView({ block: "center" }), 50); }}><Plus className="size-3.5" />New issue or request</Button>} />

      <MessagesSection />

      <section aria-label="Today's room bookings">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Today's room bookings</h2><Link href="/app/rooms" className="text-xs font-medium text-[var(--brand)] hover:underline">Open calendar →</Link></div>
        {bookings.isLoading ? <Skeleton className="h-16" /> : bookings.data?.length ? (
          <ul className="divide-y divide-[var(--line)] rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)]">
            {bookings.data.map((b) => (
              <li key={b.id}>
                <button type="button" disabled={!b.canEdit} onClick={() => setEditing(b)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left enabled:hover:bg-[var(--surface-2)] enabled:cursor-pointer">
                  <span className="flex min-w-0 items-center gap-2.5"><span className="size-2 shrink-0 rounded-full" style={{ background: room(b.roomId)?.color }} /><span className="truncate text-sm"><span className="font-medium">{room(b.roomId)?.name}</span> · {b.title ?? "Reserved"}{b.bookedFor ? ` (for ${b.bookedFor})` : ""}{b.owner && !b.mine ? <span className="text-[var(--ink-mute)]"> · {b.owner}</span> : null}</span></span>
                  <span className="tnum shrink-0 text-xs text-[var(--ink-soft)]">{hm(b.startsAt)} – {hm(b.endsAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-[var(--ink-mute)]">No rooms are booked today.</p>}
      </section>

      <section aria-label="Rooms">
        <h2 className="mb-2 text-sm font-semibold">Rooms</h2>
        {rooms.isLoading ? <Skeleton className="h-32" /> : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {rooms.data?.map((r) => {
              const st = statusOf(r);
              return (
                <div key={r.id} className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)]">
                  <RoomPhoto room={r} className="aspect-[16/9] w-full" />
                  <div className="flex items-center justify-between gap-2 px-3.5 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="text-sm font-semibold">{r.name}</span><span className="flex items-center gap-1 text-xs text-[var(--ink-mute)]"><Users className="size-3" />{r.seats}</span></div>
                      <div className={clsx("text-xs", st.free ? "text-[var(--ok)]" : "text-[var(--warn)]")}>{st.text}</div>
                    </div>
                    <Button variant="outline" onClick={() => bookNow(r.id)}>Book</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ItemsSection open={newItem} setOpen={setNewItem} />

      {draft && rooms.data && <BookingDialog rooms={rooms.data} draft={draft} note={area.data?.bookingNote} onClose={() => setDraft(null)} />}
      {editing && rooms.data && <BookingDialog rooms={rooms.data} booking={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
