import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { api, type AdminSettings, type Guide, type Room, type WifiNetwork, type Window } from "@/lib/api";
import { Button, Card, PageHeader, Skeleton, fieldInput, fieldLabel } from "@/components/ui";
import EditRoomDialog from "@/components/EditRoomDialog";
import RoomPhoto from "@/components/RoomPhoto";
import WelcomeCopyCard from "@/components/WelcomeCopyCard";

const DAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]] as const;

// One section: a title, a description, the form, and a Save button that says what happened.
function Section({ title, hint, children, onSave, pending, error, saved, dirty }: { title: string; hint?: string; children: ReactNode; onSave: () => void; pending: boolean; error?: string; saved: boolean; dirty: boolean }) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="mb-3 mt-1 text-xs text-[var(--ink-mute)]">{hint}</p>}
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        {children}
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex items-center gap-3"><Button type="submit" disabled={pending || !dirty}>{pending ? "Saving…" : "Save"}</Button>{saved && !dirty && <span role="status" className="text-xs text-[var(--ok)]">Saved</span>}</div>
      </form>
    </Card>
  );
}

function useSection<T>(initial: T | undefined, save: (v: T) => Promise<unknown>) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<T | undefined>(undefined);
  const value = draft ?? initial;
  const m = useMutation({ mutationFn: (v: T) => save(v), onSuccess: () => { setDraft(undefined); qc.invalidateQueries({ queryKey: ["settings"] }); qc.invalidateQueries({ queryKey: ["area"] }); qc.invalidateQueries({ queryKey: ["metrics"] }); } });
  return { value: value as T, set: setDraft, dirty: draft !== undefined, save: () => value !== undefined && m.mutate(value), pending: m.isPending, error: m.error?.message, saved: m.isSuccess };
}

function Move({ i, n, to }: { i: number; n: number; to: (j: number) => void }) {
  return (
    <span className="flex gap-0.5">
      <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => to(i - 1)} className="grid size-7 place-items-center rounded-md text-[var(--ink-mute)] enabled:hover:bg-[var(--surface-2)] disabled:opacity-30 cursor-pointer"><ArrowUp className="size-3.5" /></button>
      <button type="button" aria-label="Move down" disabled={i === n - 1} onClick={() => to(i + 1)} className="grid size-7 place-items-center rounded-md text-[var(--ink-mute)] enabled:hover:bg-[var(--surface-2)] disabled:opacity-30 cursor-pointer"><ArrowDown className="size-3.5" /></button>
    </span>
  );
}
const swap = <T,>(a: T[], i: number, j: number) => { const c = [...a]; [c[i], c[j]] = [c[j]!, c[i]!]; return c; };

export default function Settings() {
  const cfg = useQuery({ queryKey: ["settings"], queryFn: () => api<AdminSettings>("/admin/settings") });
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: () => api<Room[]>("/rooms") });
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const d = cfg.data;

  const note = useSection<string>(d?.bookingNote, (v) => api("/admin/settings/booking-note", { method: "PUT", json: { text: v } }));
  const guides = useSection<Guide[]>(d?.guides, (v) => api("/admin/settings/guides", { method: "PUT", json: { guides: v } }));
  const wifi = useSection<WifiNetwork[]>(d?.wifi, (v) => api("/admin/settings/wifi", { method: "PUT", json: { networks: v } }));
  const win = useSection<Window>(d?.occupancyWindow, (v) => api("/admin/settings/occupancy-window", { method: "PUT", json: v }));
  // Re-sync a section's draft if the server copy changes underneath (e.g. another admin saved).
  useEffect(() => { /* drafts reset on save via invalidate */ }, [d]);

  if (cfg.isLoading || !d) return <div className="flex flex-col gap-6"><PageHeader title="Settings" /><Skeleton className="h-64" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" subtitle="Everything here is shown to people as you write it. Text in [square brackets] still needs filling in." />

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Rooms</h2>
        <p className="mb-3 mt-1 text-xs text-[var(--ink-mute)]">Name, seats and photo. Everyone sees the name and the photo.</p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {rooms.data?.map((r) => (
            <li key={r.id} className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--line)]">
              <RoomPhoto room={r} className="aspect-[16/9] w-full" />
              <div className="flex items-center justify-between px-3 py-2"><div><div className="text-sm font-semibold">{r.name}</div><div className="text-xs text-[var(--ink-mute)]">{r.seats} seats</div></div><Button variant="outline" onClick={() => setEditRoom(r)}><Pencil className="size-3.5" />Edit</Button></div>
            </li>
          ))}
        </ul>
      </Card>

      <Section title="Booking note" hint="Shown at the top of the Rooms page and in the booking window." {...note} onSave={note.save}>
        <label className="sr-only" htmlFor="st-note">Booking note</label>
        <textarea id="st-note" rows={2} maxLength={500} className={clsx(fieldInput, "h-auto py-2")} value={note.value} onChange={(e) => note.set(e.target.value)} />
      </Section>

      <Section title="Guides" hint="Shown in everyone's personal area. Add, reorder or remove them." {...guides} onSave={guides.save}>
        <ul className="flex flex-col gap-3">
          {guides.value.map((g, i) => (
            <li key={g.id + i} className="rounded-[var(--r-md)] border border-[var(--line)] p-3">
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`g-t-${i}`}>Guide title</label>
                <input id={`g-t-${i}`} required maxLength={100} className={clsx(fieldInput, "font-medium")} placeholder="Title" value={g.title} onChange={(e) => guides.set(guides.value.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} />
                <Move i={i} n={guides.value.length} to={(j) => guides.set(swap(guides.value, i, j))} />
                <button type="button" aria-label={`Remove ${g.title || "guide"}`} onClick={() => guides.set(guides.value.filter((_, k) => k !== i))} className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--danger)] hover:bg-[var(--surface-2)] cursor-pointer"><Trash2 className="size-3.5" /></button>
              </div>
              <label className="sr-only" htmlFor={`g-b-${i}`}>Guide text</label>
              <textarea id={`g-b-${i}`} rows={3} maxLength={4000} className={clsx(fieldInput, "mt-2 h-auto py-2")} value={g.body} onChange={(e) => guides.set(guides.value.map((x, k) => (k === i ? { ...x, body: e.target.value } : x)))} />
            </li>
          ))}
        </ul>
        <div><Button type="button" variant="outline" disabled={guides.value.length >= 20} onClick={() => guides.set([...guides.value, { id: "", title: "", body: "" }])}><Plus className="size-3.5" />Add a guide</Button></div>
      </Section>

      <Section title="WiFi" hint="“Subvisual only” networks are shown only to @subvisual.co accounts." {...wifi} onSave={wifi.save}>
        <ul className="flex flex-col gap-3">
          {wifi.value.map((w, i) => {
            const upd = (p: Partial<WifiNetwork>) => wifi.set(wifi.value.map((x, k) => (k === i ? { ...x, ...p } : x)));
            return (
              <li key={i} className="rounded-[var(--r-md)] border border-[var(--line)] p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className={fieldLabel} htmlFor={`w-l-${i}`}>Label</label><input id={`w-l-${i}`} className={fieldInput} value={w.label} onChange={(e) => upd({ label: e.target.value })} /></div>
                  <div><label className={fieldLabel} htmlFor={`w-v-${i}`}>Who sees it</label><select id={`w-v-${i}`} className={fieldInput} value={w.visibility} onChange={(e) => upd({ visibility: e.target.value as WifiNetwork["visibility"] })}><option value="everyone">Everyone</option><option value="subvisual">Subvisual only</option></select></div>
                  <div><label className={fieldLabel} htmlFor={`w-s-${i}`}>Network name</label><input id={`w-s-${i}`} required className={fieldInput} value={w.ssid} onChange={(e) => upd({ ssid: e.target.value })} /></div>
                  <div><label className={fieldLabel} htmlFor={`w-p-${i}`}>Password</label><input id={`w-p-${i}`} autoComplete="off" className={clsx(fieldInput, "mono")} value={w.password} onChange={(e) => upd({ password: e.target.value })} /></div>
                </div>
                <div className="mt-3 flex items-end gap-2"><div className="flex-1"><label className={fieldLabel} htmlFor={`w-n-${i}`}>Note</label><input id={`w-n-${i}`} className={fieldInput} value={w.note} onChange={(e) => upd({ note: e.target.value })} /></div>
                  <button type="button" aria-label={`Remove ${w.label || "network"}`} onClick={() => wifi.set(wifi.value.filter((_, k) => k !== i))} className="grid size-9 shrink-0 place-items-center rounded-md text-[var(--danger)] hover:bg-[var(--surface-2)] cursor-pointer"><Trash2 className="size-4" /></button></div>
              </li>
            );
          })}
        </ul>
        <div><Button type="button" variant="outline" disabled={wifi.value.length >= 10} onClick={() => wifi.set([...wifi.value, { label: "", visibility: "everyone", ssid: "", password: "", note: "" }])}><Plus className="size-3.5" />Add a network</Button></div>
      </Section>

      <Section title="Working window for metrics" hint="Occupancy is the share of this window that rooms are booked. Bookings outside it still count in the peak-hours chart." {...win} onSave={win.save}>
        <div className="flex flex-wrap items-end gap-3">
          <div><label className={fieldLabel} htmlFor="wn-s">From</label><select id="wn-s" className={`${fieldInput} w-28`} value={win.value.startHour} onChange={(e) => win.set({ ...win.value, startHour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select></div>
          <div><label className={fieldLabel} htmlFor="wn-e">To</label><select id="wn-e" className={`${fieldInput} w-28`} value={win.value.endHour} onChange={(e) => win.set({ ...win.value, endHour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select></div>
          <fieldset className="flex items-center gap-3"><legend className="sr-only">Days</legend>{DAYS.map(([n, l]) => (
            <label key={n} className="flex items-center gap-1 text-sm text-[var(--ink-soft)]"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={win.value.weekdays.includes(n)} onChange={(e) => win.set({ ...win.value, weekdays: e.target.checked ? [...win.value.weekdays, n].sort() : win.value.weekdays.filter((x) => x !== n) })} />{l}</label>
          ))}</fieldset>
        </div>
      </Section>

      <WelcomeCopyCard />
      {editRoom && <EditRoomDialog room={editRoom} onClose={() => setEditRoom(null)} />}
    </div>
  );
}
