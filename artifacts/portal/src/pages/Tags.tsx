import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Mail, X } from "lucide-react";
import clsx from "clsx";
import { api, type AdminTags, type AdminUser, type Company, type TagBatch, type TagLine, type TagLogRow, type TagNotifications, type TagRow } from "@/lib/api";
import { Badge, Button, Card, Dialog, EmptyState, PageHeader, Skeleton, fieldCompact, fieldInput, fieldLabel } from "@/components/ui";
import { eventLabel, levelLabel, lineText, statusLabel } from "@/lib/tags";
import { fmtDay, hm, ymd } from "@/lib/time";
import { askConfirm } from "@/components/Confirm";

const KEYS = ["admin-tags", "tag-log", "tag-notifications", "inbox-count", "admin-users"];
const refresh = (qc: ReturnType<typeof useQueryClient>) => KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
const when = (iso: string) => `${fmtDay(ymd(iso), { day: "numeric", month: "short" })} ${hm(iso)}`;

// ── Door code (set or change; the code itself is never shown here) ──────────
function CodeCell({ tagId, number, hasCode }: { tagId: string; number: string; hasCode: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const save = useMutation({ mutationFn: () => api(`/admin/tags/${tagId}/code`, { method: "PUT", json: { code } }), onSuccess: () => { setOpen(false); setCode(""); refresh(qc); } });
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-left text-xs text-[var(--brand)] hover:underline cursor-pointer">{hasCode ? "•••• · change" : "Set code"}</button>;
  return (
    <form className="flex flex-col gap-1" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="flex items-center gap-1">
        <input aria-label={`New code for tag ${number}`} inputMode="numeric" pattern="\d{4}" maxLength={4} autoFocus className="mono h-7 w-16 rounded-md border border-[var(--line-strong)] px-2 text-sm" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        <Button type="submit" variant="outline" disabled={save.isPending || code.length !== 4}>Save</Button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-[var(--ink-mute)] cursor-pointer">Cancel</button>
      </div>
      {save.isError && <span role="alert" className="max-w-56 text-xs text-[var(--danger)]">{save.error.message}</span>}
    </form>
  );
}

// ── Send the pending batch: shows the link ONCE ─────────────────────────────
function LinkBox({ link, message, email }: { link: string; message: string; email?: string }) {
  const [copied, setCopied] = useState<"link" | "msg" | null>(null);
  const copy = (what: "link" | "msg", text: string) => navigator.clipboard.writeText(text).then(() => { setCopied(what); setTimeout(() => setCopied(null), 1500); });
  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-md bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink-soft)]">Anyone with this link can mark these changes as done, so send it privately. It works for 14 days. For security it is shown only now; if you lose it, make a new one from the sent batch.</p>
      <pre className="whitespace-pre-wrap break-all rounded-md border border-[var(--line)] p-3 font-sans text-sm">{message}</pre>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => copy("msg", message)}>{copied === "msg" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied === "msg" ? "Copied" : "Copy message"}</Button>
        <Button variant="outline" onClick={() => copy("link", link)}>{copied === "link" ? "Copied" : "Copy link only"}</Button>
        {email && <a href={`mailto:${email}?subject=${encodeURIComponent("Access tag request — Office 42")}&body=${encodeURIComponent(message)}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line-strong)] px-3 text-sm font-medium hover:bg-[var(--surface-2)]"><Mail className="size-3.5" />Open email</a>}
      </div>
    </div>
  );
}

function PendingBatch({ batch, supplierEmail }: { batch: TagBatch | null; supplierEmail?: string }) {
  const qc = useQueryClient();
  const [sent, setSent] = useState<{ link: string; message: string } | null>(null);
  const lines = batch?.lines.filter((l) => l.status === "pending") ?? [];
  const drop = useMutation({ mutationFn: (id: string) => api(`/admin/changes/${id}`, { method: "DELETE" }), onSuccess: () => refresh(qc) });
  const send = useMutation({ mutationFn: () => api<{ link: string; message: string }>("/admin/tag-batches/send", { method: "POST", json: { origin: window.location.origin } }), onSuccess: (r) => { setSent(r); refresh(qc); } });
  return (
    <section aria-label="Pending batch">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Pending batch for Ricardo ({lines.length})</h2>
        <Button disabled={!lines.length || send.isPending} onClick={() => askConfirm(`Send ${lines.length} change${lines.length === 1 ? "" : "s"} to Ricardo? You'll get a link to share.`).then((ok) => ok && send.mutate())}>{send.isPending ? "Sending…" : "Send to Ricardo"}</Button>
      </div>
      {lines.length ? (
        <ul className="flex flex-col gap-2">{lines.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5">
            <span className="text-sm">{lineText(l)}{l.note && <span className="text-[var(--ink-mute)]"> · {l.note}</span>}</span>
            <button type="button" aria-label={`Take back the change for tag ${l.tagNumber}`} disabled={drop.isPending} onClick={() => drop.mutate(l.id)} className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--ink-mute)] hover:bg-[var(--surface-2)] cursor-pointer"><X className="size-4" /></button>
          </li>
        ))}</ul>
      ) : <EmptyState title="Nothing waiting" body="Changes you make to tags are collected here until you send them. They become one request." />}
      {(drop.isError || send.isError) && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{(drop.error ?? send.error)!.message}</p>}
      {sent && <Dialog title="Request sent" description="The batch is closed. New changes will start a new batch." onClose={() => setSent(null)}><LinkBox {...sent} email={supplierEmail} /></Dialog>}
    </section>
  );
}

// ── Batches already sent ────────────────────────────────────────────────────
function SentBatch({ b, supplierEmail }: { b: TagBatch; supplierEmail?: string }) {
  const qc = useQueryClient();
  const [link, setLink] = useState<{ link: string; message: string } | null>(null);
  const live = b.lines.filter((l) => l.status !== "removed");
  const doneCount = live.filter((l) => l.status === "done").length;
  const regen = useMutation({ mutationFn: () => api<{ link: string; message: string }>(`/admin/tag-batches/${b.id}/regenerate-link`, { method: "POST", json: { origin: window.location.origin } }), onSuccess: (r) => { setLink(r); refresh(qc); } });
  const revoke = useMutation({ mutationFn: () => api(`/admin/tag-batches/${b.id}/revoke-link`, { method: "POST" }), onSuccess: () => refresh(qc) });
  const line = useMutation({ mutationFn: ({ id, act }: { id: string; act: "done" | "reopen" }) => api(`/admin/changes/${id}/${act}`, { method: "POST" }), onSuccess: () => refresh(qc) });
  const err = regen.error ?? revoke.error ?? line.error;
  const linkState = b.linkActive ? `link works until ${when(b.expiresAt!)}` : b.revoked ? "link revoked" : "link expired";
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><div className="text-sm font-semibold">Sent {b.sentAt ? when(b.sentAt) : ""} · {doneCount} of {live.length} done</div><div className="text-xs text-[var(--ink-mute)]">{linkState}</div></div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={regen.isPending} onClick={() => askConfirm("Make a new link? The old one stops working.").then((ok) => ok && regen.mutate())}>New link</Button>
          {b.linkActive && <Button variant="outline" disabled={revoke.isPending} onClick={() => askConfirm("Revoke the link? Ricardo will no longer be able to open it.").then((ok) => ok && revoke.mutate())}>Revoke link</Button>}
        </div>
      </div>
      <ul className="mt-3 divide-y divide-[var(--line)]">
        {live.map((l: TagLine) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className={clsx("text-sm", l.status !== "pending" && "text-[var(--ink-soft)]")}>{lineText(l)}</span>
            <span className="flex items-center gap-2">
              {l.status === "pending" && <><Badge tone="brand">Waiting</Badge><Button variant="outline" disabled={line.isPending} onClick={() => askConfirm("Mark this as done on Ricardo's behalf? Use this if he confirmed another way.").then((ok) => ok && line.mutate({ id: l.id, act: "done" }))}>Mark done</Button></>}
              {l.status === "done" && <><span className="text-xs text-[var(--ok)]">✓ {l.doneBy} · {l.doneAt && when(l.doneAt)}</span><button type="button" className="text-xs text-[var(--brand)] hover:underline cursor-pointer" disabled={line.isPending} onClick={() => askConfirm("Undo this? The tag goes back to how it was.").then((ok) => ok && line.mutate({ id: l.id, act: "reopen" }))}>Undo</button></>}
              {l.status === "outdated" && <Badge>Out of date: not applied</Badge>}
            </span>
          </li>
        ))}
      </ul>
      {err && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{err.message}</p>}
      {link && <Dialog title="New link" description="The previous link no longer works." onClose={() => setLink(null)}><LinkBox {...link} email={supplierEmail} /></Dialog>}
    </Card>
  );
}

// ── One tag: make a change (goes to the batch) or edit details (direct) ─────
function TagDialog({ tag, users, companies, onClose }: { tag: TagRow; users: AdminUser[]; companies: Company[]; onClose: () => void }) {
  const qc = useQueryClient();
  const free = users.filter((u) => !u.tag && !u.hasOpenRequest && !u.deactivatedAt);
  const [kind, setKind] = useState(tag.baseStatus === "spare" ? "assign" : tag.baseStatus === "active" ? "reassign" : "lost");
  const [userId, setUserId] = useState(""), [name, setName] = useState(tag.user ?? tag.holderName), [note, setNote] = useState("");
  const [level, setLevel] = useState(tag.level), [tnote, setTnote] = useState(tag.note), [companyId, setCompanyId] = useState(tag.companyId ?? "");
  const change = useMutation({ mutationFn: () => api(`/admin/tags/${tag.id}/changes`, { method: "POST", json: { kind, userId, name, note } }), onSuccess: () => { refresh(qc); onClose(); } });
  const details = useMutation({ mutationFn: (b: object) => api(`/admin/tags/${tag.id}`, { method: "PATCH", json: b }), onSuccess: () => { refresh(qc); onClose(); } });
  const options: [string, string][] = tag.baseStatus === "spare" ? [["assign", "Assign to a person"]]
    : tag.baseStatus === "active" ? [["reassign", "Give to another person"], ["rename", "Change the name on the tag"], ["return", "Tag returned (back to spare)"], ["lost", "Mark as lost"]]
    : tag.baseStatus === "blocked" ? [["lost", "Mark as lost"]] : [];
  const err = change.error ?? details.error;
  return (
    <Dialog title={`Tag ${tag.number}`} description={`${statusLabel[tag.status]}${tag.holderName ? ` · registered to ${tag.holderName}` : ""}`} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {tag.pending ? <p className="rounded-md bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-soft)]">This tag has a change waiting for Ricardo ({tag.pending.kind}). Finish or take it back before changing it again.</p> : options.length ? (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); change.mutate(); }}>
            <h3 className="text-sm font-semibold">Change (goes to the pending batch)</h3>
            <select aria-label="Type of change" className={fieldInput} value={kind} onChange={(e) => setKind(e.target.value)}>{options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            {(kind === "assign" || kind === "reassign") && <div><label className={fieldLabel} htmlFor="tg-user">Person</label><select id="tg-user" required className={fieldInput} value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">Choose…</option>{free.filter((u) => u.id !== tag.clientId).map((u) => <option key={u.id} value={u.id}>{u.name}{u.company ? ` · ${u.company}` : ""}</option>)}</select><p className="mt-1 text-xs text-[var(--ink-mute)]">Only people without a tag are listed.</p></div>}
            {kind === "rename" && <div><label className={fieldLabel} htmlFor="tg-name">New name on the tag</label><input id="tg-name" required className={fieldInput} value={name} onChange={(e) => setName(e.target.value)} /></div>}
            {kind === "lost" && <p className="text-xs text-[var(--ink-soft)]">To stop it working right away, also change its code on the table below.</p>}
            <div><label className={fieldLabel} htmlFor="tg-note">Note for the log (optional)</label><input id="tg-note" className={fieldInput} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <div><Button type="submit" disabled={change.isPending || ((kind === "assign" || kind === "reassign") && !userId)}>Add to pending batch</Button></div>
          </form>
        ) : <p className="text-sm text-[var(--ink-mute)]">A lost tag has no further changes.</p>}

        {!tag.pending && (tag.baseStatus === "active" || tag.baseStatus === "blocked") && (
          <div><h3 className="mb-2 text-sm font-semibold">Block</h3>
            <Button variant="outline" disabled={details.isPending} onClick={() => details.mutate({ status: tag.baseStatus === "active" ? "blocked" : "active" })}>{tag.baseStatus === "active" ? "Block this tag" : "Unblock this tag"}</Button>
            <p className="mt-1 text-xs text-[var(--ink-mute)]">Recorded here straight away, without Ricardo.</p></div>
        )}

        <form className="flex flex-col gap-3 border-t border-[var(--line)] pt-4" onSubmit={(e) => { e.preventDefault(); details.mutate({ accessLevel: level, note: tnote, companyId: companyId || null }); }}>
          <h3 className="text-sm font-semibold">Details (saved straight away)</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={fieldLabel} htmlFor="td-level">Access level</label><select id="td-level" className={fieldInput} value={level} onChange={(e) => setLevel(e.target.value as TagRow["level"])}>{Object.entries(levelLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div><label className={fieldLabel} htmlFor="td-co">Company</label><select id="td-co" className={fieldInput} value={companyId} onChange={(e) => setCompanyId(e.target.value)}><option value="">None</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          </div>
          <div><label className={fieldLabel} htmlFor="td-note">Note</label><input id="td-note" className={fieldInput} maxLength={300} value={tnote} onChange={(e) => setTnote(e.target.value)} /></div>
          <div><Button type="submit" variant="outline" className="h-9" disabled={details.isPending}>Save details</Button></div>
        </form>
        {err && <p role="alert" className="text-sm text-[var(--danger)]">{err.message}</p>}
      </div>
    </Dialog>
  );
}

export default function Tags() {
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["admin-tags"], queryFn: () => api<AdminTags>("/admin/tags") });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => api<AdminUser[]>("/admin/users") });
  const companies = useQuery({ queryKey: ["admin-companies"], queryFn: () => api<Company[]>("/admin/companies") });
  const notes = useQuery({ queryKey: ["tag-notifications"], queryFn: () => api<TagNotifications>("/admin/tag-notifications"), refetchInterval: 60_000 });
  const [showLog, setShowLog] = useState(false);
  const log = useQuery({ queryKey: ["tag-log"], queryFn: () => api<TagLogRow[]>("/admin/tag-log?limit=60"), enabled: showLog });
  const [editing, setEditing] = useState<TagRow | null>(null);
  const [add, setAdd] = useState({ number: "", level: "user", userId: "", note: "" });
  const [sup, setSup] = useState<{ name: string; email: string } | null>(null);
  const seen = useMutation({ mutationFn: () => api("/admin/tag-notifications/seen", { method: "POST" }), onSuccess: () => refresh(qc) });
  const addTag = useMutation({ mutationFn: () => api("/admin/tags", { method: "POST", json: { number: add.number, accessLevel: add.level, userId: add.userId || null, note: add.note } }), onSuccess: () => { setAdd({ number: "", level: "user", userId: "", note: "" }); refresh(qc); } });
  const supplier = data.data?.supplier ?? {};
  const supForm = sup ?? { name: supplier.name ?? "", email: supplier.email ?? "" };
  const saveSup = useMutation({ mutationFn: () => api("/admin/supplier", { method: "PUT", json: supForm }), onSuccess: () => { setSup(null); refresh(qc); } });
  const free = (users.data ?? []).filter((u) => !u.tag && !u.hasOpenRequest && !u.deactivatedAt);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tags" subtitle="Changes to who has a tag go to Ricardo in batches. A tag only changes once he marks the change done." />
      {!!notes.data?.unread && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-lg)] border border-[color-mix(in_oklch,var(--brand)_30%,transparent)] bg-[var(--brand-soft)] px-4 py-3 text-sm text-[var(--brand-ink)]">
          <span><b>{notes.data.unread}</b> update{notes.data.unread === 1 ? "" : "s"} from Ricardo: {notes.data.items.slice(0, 3).map((i) => `${i.tagNumber} ${i.event === "line_outdated" ? "not applied" : i.detail}`).join(" · ")}{notes.data.unread > 3 ? " …" : ""}</span>
          <Button variant="outline" disabled={seen.isPending} onClick={() => seen.mutate()}>Mark as seen</Button>
        </div>
      )}
      {data.isLoading ? <Skeleton className="h-48" /> : (
        <>
          <PendingBatch batch={data.data?.open ?? null} supplierEmail={supplier.email} />
          {!!data.data?.sent.length && <section><h2 className="mb-2 text-sm font-semibold">Sent to Ricardo</h2><div className="flex flex-col gap-3">{data.data.sent.map((b) => <SentBatch key={b.id + b.status} b={b} supplierEmail={supplier.email} />)}</div></section>}

          <section>
            <h2 className="mb-2 text-sm font-semibold">All tags ({data.data?.tags.length ?? 0})</h2>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wide text-[var(--ink-mute)]"><th className="px-4 py-2 font-medium">Tag</th><th className="px-4 py-2 font-medium">Registered to</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Level</th><th className="px-4 py-2 font-medium">Company</th><th className="px-4 py-2 font-medium">Code</th><th className="px-4 py-2"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {data.data?.tags.map((t) => (
                    <tr key={t.id} className="border-b border-[var(--line)] last:border-0 align-top">
                      <td className="mono whitespace-nowrap px-4 py-2">{t.number}</td>
                      <td className="px-4 py-2">{t.holderName || <span className="text-[var(--ink-mute)]">—</span>}{t.pending && <div className="text-xs text-[var(--brand)]">→ {t.pending.toName || t.pending.kind} (waiting)</div>}{t.note && <div className="text-xs text-[var(--ink-mute)]">{t.note}</div>}</td>
                      <td className="whitespace-nowrap px-4 py-2"><Badge tone={t.status === "active" ? "brand" : "neutral"}>{statusLabel[t.status]}</Badge></td>
                      <td className="whitespace-nowrap px-4 py-2 text-[var(--ink-soft)]">{levelLabel[t.level]}</td>
                      <td className="px-4 py-2 text-[var(--ink-soft)]">{t.company ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2"><CodeCell tagId={t.id} number={t.number} hasCode={t.hasCode} /></td>
                      <td className="whitespace-nowrap px-4 py-2 text-right"><Button variant="outline" onClick={() => setEditing(t)}>Change…</Button></td>
                    </tr>
                  ))}
                  {!data.data?.tags.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-[var(--ink-mute)]">No tags yet. Add the existing ones below.</td></tr>}
                </tbody>
              </table>
            </Card>
          </section>

          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold">Add a tag</h2>
            <p className="mb-3 text-xs text-[var(--ink-mute)]">Records a tag that exists (or a new spare one). It's bookkeeping, not a request to Ricardo.</p>
            <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); addTag.mutate(); }}>
              <div><label className={fieldLabel} htmlFor="ad-n">Tag number</label><input id="ad-n" required className={`${fieldCompact} w-32`} value={add.number} onChange={(e) => setAdd({ ...add, number: e.target.value })} /></div>
              <div><label className={fieldLabel} htmlFor="ad-l">Level</label><select id="ad-l" className={`${fieldCompact} w-40`} value={add.level} onChange={(e) => setAdd({ ...add, level: e.target.value })}>{Object.entries(levelLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
              <div><label className={fieldLabel} htmlFor="ad-u">Held by</label><select id="ad-u" className={`${fieldCompact} w-52`} value={add.userId} onChange={(e) => setAdd({ ...add, userId: e.target.value })}><option value="">Nobody (spare)</option>{free.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
              <div><label className={fieldLabel} htmlFor="ad-t">Note</label><input id="ad-t" className={`${fieldCompact} w-48`} value={add.note} onChange={(e) => setAdd({ ...add, note: e.target.value })} /></div>
              <Button type="submit" variant="outline" className="h-9" disabled={addTag.isPending}>Add</Button>
            </form>
            {addTag.isError && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{addTag.error.message}</p>}
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold">Supplier</h2>
            <p className="mb-3 text-xs text-[var(--ink-mute)]">Optional. If you add Ricardo's email, "Open email" appears when you send a batch.</p>
            <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); saveSup.mutate(); }}>
              <div><label className={fieldLabel} htmlFor="sup-name">Company</label><input id="sup-name" className={`${fieldCompact} w-56`} value={supForm.name} onChange={(e) => setSup({ ...supForm, name: e.target.value })} /></div>
              <div><label className={fieldLabel} htmlFor="sup-email">Email</label><input id="sup-email" type="email" className={`${fieldCompact} w-64`} placeholder="supplier@example.com" value={supForm.email} onChange={(e) => setSup({ ...supForm, email: e.target.value })} /></div>
              <Button type="submit" variant="outline" className="h-9" disabled={saveSup.isPending || sup === null}>Save</Button>
              {saveSup.isSuccess && sup === null && <span className="pb-2 text-xs text-[var(--ok)]">Saved</span>}
            </form>
            {saveSup.isError && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{saveSup.error.message}</p>}
          </Card>

          <section>
            <button type="button" onClick={() => setShowLog(!showLog)} className="text-sm font-semibold hover:underline cursor-pointer">{showLog ? "Hide" : "Show"} log</button>
            {showLog && (log.isLoading ? <Skeleton className="mt-2 h-24" /> : (
              <Card className="mt-2"><ul className="divide-y divide-[var(--line)]">{log.data?.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                  <span><span className="font-medium">{eventLabel[r.event] ?? r.event}</span>{r.tagNumber && <span className="mono ml-2 text-[var(--ink-soft)]">{r.tagNumber}</span>}{r.detail && <span className="text-[var(--ink-mute)]"> · {r.detail}</span>}</span>
                  <span className="text-xs text-[var(--ink-mute)]">{r.actor} · {when(r.createdAt)}</span>
                </li>
              ))}</ul></Card>
            ))}
          </section>
        </>
      )}
      {editing && users.data && <TagDialog tag={editing} users={users.data} companies={companies.data ?? []} onClose={() => setEditing(null)} />}
    </div>
  );
}
