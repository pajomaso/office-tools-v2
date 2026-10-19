import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus } from "lucide-react";
import clsx from "clsx";
import { api, type AdminTags, type AdminUser, type Company, type MailPreview, type Me } from "@/lib/api";
import { Badge, Button, Card, Dialog, PageHeader, Skeleton, fieldInput, fieldCompact, fieldLabel } from "@/components/ui";
import { askConfirm } from "@/components/Confirm";
import { Link } from "wouter";

const refresh = (qc: ReturnType<typeof useQueryClient>) => ["admin-users", "admin-companies", "admin-tags", "inbox-count", "inbox-todo"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

function MailPreviewBox({ m }: { m: MailPreview }) {
  const [copied, setCopied] = useState(false);
  const text = `To: ${m.preview.to}\nSubject: ${m.preview.subject}\n\n${m.preview.body}`;
  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-md bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink-soft)]">
        {m.sent ? "Email sent." : "Not sent: no email service is connected yet. Copy the text below and send it yourself, or share the sign-in link."}
      </p>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--line)] p-3 font-sans text-xs">{text}</pre>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "Copied" : "Copy email"}
        </Button>
        {m.devLink && <a href={m.devLink} className="text-xs text-[var(--brand)] hover:underline">Local dev only: open the sign-in link →</a>}
      </div>
    </div>
  );
}

function UserForm({ companies, initial, onDone, submitLabel, endpoint, method }: {
  companies: Company[]; initial: { name: string; email: string; companyId: string; kind: string; role: string }; onDone: () => void;
  submitLabel: string; endpoint: string; method: "POST" | "PATCH";
}) {
  const qc = useQueryClient();
  const [f, setF] = useState(initial);
  const save = useMutation({ mutationFn: () => api(endpoint, { method, json: f }), onSuccess: () => { refresh(qc); onDone(); } });
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={fieldLabel} htmlFor="u-name">Name</label><input id="u-name" required className={fieldInput} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className={fieldLabel} htmlFor="u-email">Email</label><input id="u-email" type="email" required disabled={method === "PATCH"} className={fieldInput} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><label className={fieldLabel} htmlFor="u-kind">Type</label>
          <select id="u-kind" className={fieldInput} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="company">Company member</option><option value="event">One-off event (client, meetup)</option></select></div>
        <div><label className={fieldLabel} htmlFor="u-co">Company</label>
          <select id="u-co" disabled={f.kind === "event"} className={fieldInput} value={f.kind === "event" ? "" : f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}><option value="">None</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]"><input type="checkbox" checked={f.role === "admin"} onChange={(e) => setF({ ...f, role: e.target.checked ? "admin" : "user" })} className="size-4 accent-[var(--brand)]" />Admin (can manage users, tags and settings)</label>
      {save.isError && <p role="alert" className="text-sm text-[var(--danger)]">{save.error.message}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" className="h-9" onClick={onDone}>Close</Button><Button type="submit" disabled={save.isPending}>{submitLabel}</Button></div>
    </form>
  );
}

function OnboardDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const qc = useQueryClient();
  const tags = useQuery({ queryKey: ["admin-tags"], queryFn: () => api<AdminTags>("/admin/tags") });
  const spare = tags.data?.tags.filter((t) => t.status === "spare" && !t.clientId) ?? [];
  const [tag, setTag] = useState(""), [code, setCode] = useState(""), [send, setSend] = useState(true);
  const go = useMutation({
    mutationFn: () => api<{ welcome: MailPreview | null }>(`/admin/users/${user.id}/onboard`, { method: "POST", json: { tagNumber: tag, code, sendWelcome: send } }),
    onSuccess: () => refresh(qc),
  });
  return (
    <Dialog title={`Onboard ${user.name}`} description="Give them a tag and a 4-digit code. The change is added to the pending batch for Ricardo." onClose={onClose}>
      {go.isSuccess ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--ink-soft)]">Done. Tag <span className="mono font-medium">{tag}</span> is <b>pending</b>: it joins the pending batch on the Tags page and becomes active once Ricardo marks it done.</p>
          {go.data.welcome && <MailPreviewBox m={go.data.welcome} />}
          <div className="flex justify-end"><Button onClick={onClose}>Close</Button></div>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); go.mutate(); }}>
          <div>
            <label className={fieldLabel} htmlFor="ob-tag">Tag number</label>
            <input id="ob-tag" required list="spare-tags" autoFocus className={fieldInput} value={tag} onChange={(e) => setTag(e.target.value)} placeholder={spare[0]?.number ?? "Number printed on the tag"} />
            <datalist id="spare-tags">{spare.map((t) => <option key={t.id} value={t.number} />)}</datalist>
            <p className="mt-1 text-xs text-[var(--ink-mute)]">{spare.length ? `Spare tags: ${spare.map((t) => t.number).join(", ")}. ` : "No spare tags. "}A new number also works (it's a new tag from the supplier).</p>
          </div>
          <div>
            <label className={fieldLabel} htmlFor="ob-code">4-digit code</label>
            <input id="ob-code" required inputMode="numeric" pattern="\d{4}" maxLength={4} className={clsx(fieldCompact, "mono w-28")} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <p className="mt-1 text-xs text-[var(--ink-mute)]">Must not be used by any other tag.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]"><input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} className="size-4 accent-[var(--brand)]" />Prepare the welcome email</label>
          {go.isError && <p role="alert" className="text-sm text-[var(--danger)]">{go.error.message}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" className="h-9" onClick={onClose}>Close</Button><Button type="submit" disabled={go.isPending || !tag.trim() || code.length !== 4}>{go.isPending ? "Saving…" : "Onboard"}</Button></div>
        </form>
      )}
    </Dialog>
  );
}

function InviteDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const send = useMutation({ mutationFn: () => api<MailPreview>(`/admin/users/${user.id}/invite`, { method: "POST", json: { origin: window.location.origin } }) });
  return (
    <Dialog title={`Welcome email for ${user.name}`} description="Creates a new sign-in link (valid 7 days, works once) and fills the welcome email." onClose={onClose}>
      {send.data ? <MailPreviewBox m={send.data} /> : (
        <div className="flex flex-col gap-3">
          {send.isError && <p role="alert" className="text-sm text-[var(--danger)]">{send.error.message}</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" className="h-9" onClick={onClose}>Close</Button><Button onClick={() => send.mutate()} disabled={send.isPending}>Prepare email</Button></div>
        </div>
      )}
    </Dialog>
  );
}

export default function Users({ me }: { me: Me }) {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => api<AdminUser[]>("/admin/users") });
  const companies = useQuery({ queryKey: ["admin-companies"], queryFn: () => api<Company[]>("/admin/companies") });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [onboarding, setOnboarding] = useState<AdminUser | null>(null);
  const [inviting, setInviting] = useState<AdminUser | null>(null);
  const [co, setCo] = useState("");
  const addCo = useMutation({ mutationFn: () => api("/admin/companies", { method: "POST", json: { name: co } }), onSuccess: () => { setCo(""); refresh(qc); } });
  const list = companies.data ?? [];
  const [notice, setNotice] = useState<string | null>(null);
  const active = useMutation({
    mutationFn: ({ u, on }: { u: AdminUser; on: boolean }) => api<{ tag?: string | null }>(`/admin/users/${u.id}/${on ? "reactivate" : "deactivate"}`, { method: "POST" }).then((r) => ({ u, on, tag: r.tag ?? null })),
    onSuccess: ({ u, on, tag }) => {
      setNotice(on ? `${u.name} can sign in again.` : `${u.name} is deactivated and was signed out everywhere.${tag ? ` They still hold tag ${tag}: mark it as returned or lost on the Tags page.` : ""}`);
      refresh(qc);
    },
  });
  const deactivate = (u: AdminUser) => askConfirm(`Deactivate ${u.name}? They are signed out everywhere and can't sign in any more. Their past bookings and messages stay. You can reactivate them later.`).then((ok) => ok && active.mutate({ u, on: false }));
  const sorted = [...(users.data ?? [])].sort((a, b) => Number(!!a.deactivatedAt) - Number(!!b.deactivatedAt));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Users" subtitle="Everyone who uses the office: people, companies and one-off events." actions={<Button onClick={() => setAdding(true)}><Plus className="size-4" />New user</Button>} />
      {notice && <p role="status" className="rounded-md bg-[var(--surface-2)] px-4 py-2.5 text-sm">{notice}{notice.includes("Tags page") && <> <Link href="/app/tags" className="font-medium text-[var(--brand)] hover:underline">Open Tags →</Link></>}</p>}
      {active.isError && <p role="alert" className="text-sm text-[var(--danger)]">{active.error.message}</p>}
      {users.isLoading ? <Skeleton className="h-40" /> : (
        <Card>
          <ul className="divide-y divide-[var(--line)]">
            {sorted.map((u) => (
              <li key={u.id} className={clsx("flex flex-wrap items-center justify-between gap-3 px-5 py-3", u.deactivatedAt && "bg-[var(--surface-2)]")}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{u.name}</span>{u.role === "admin" && <Badge tone="brand">Admin</Badge>}{u.kind === "event" && <Badge>Event</Badge>}{u.deactivatedAt && <Badge>Deactivated</Badge>}</div>
                  <div className="truncate text-xs text-[var(--ink-mute)]">{u.email} · {u.company ?? (u.kind === "event" ? "One-off event" : "No company")}{u.hasPassword ? " · has password" : ""}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="mono text-sm text-[var(--ink-soft)]">{u.tag ?? (u.pendingTag ? `${u.pendingTag} (pending)` : "no tag")}</span>
                  {u.deactivatedAt ? (
                    <Button variant="outline" disabled={active.isPending} onClick={() => active.mutate({ u, on: true })}>Reactivate</Button>
                  ) : <>
                    {!u.tag && !u.hasOpenRequest && <Button variant="outline" onClick={() => setOnboarding(u)}>Onboard</Button>}
                    <Button variant="outline" onClick={() => setInviting(u)}>Welcome email</Button>
                    <Button variant="outline" onClick={() => setEditing(u)}>Edit</Button>
                    {u.id !== me.id && <Button variant="outline" className="text-[var(--danger)]" disabled={active.isPending} onClick={() => deactivate(u)}>Deactivate</Button>}
                  </>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">Companies</h2>
        <div className="mb-3 flex flex-wrap gap-2">{list.map((c) => <Badge key={c.id}>{c.name}</Badge>)}</div>
        <form className="flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); addCo.mutate(); }}>
          <div><label className={fieldLabel} htmlFor="co-name">New company</label><input id="co-name" className={`${fieldCompact} w-64`} value={co} onChange={(e) => setCo(e.target.value)} /></div>
          <Button type="submit" variant="outline" className="h-9" disabled={!co.trim() || addCo.isPending}>Add</Button>
        </form>
        {addCo.isError && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{addCo.error.message}</p>}
      </Card>

      {adding && <Dialog title="New user" description="Creates the account. Then onboard them to give a tag and code." onClose={() => setAdding(false)}>
        <UserForm companies={list} initial={{ name: "", email: "", companyId: "", kind: "company", role: "user" }} endpoint="/admin/users" method="POST" submitLabel="Create" onDone={() => setAdding(false)} /></Dialog>}
      {editing && <Dialog title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
        <UserForm companies={list} initial={{ name: editing.name, email: editing.email, companyId: editing.companyId ?? "", kind: editing.kind, role: editing.role }} endpoint={`/admin/users/${editing.id}`} method="PATCH" submitLabel="Save" onDone={() => setEditing(null)} /></Dialog>}
      {onboarding && <OnboardDialog user={onboarding} onClose={() => setOnboarding(null)} />}
      {inviting && <InviteDialog user={inviting} onClose={() => setInviting(null)} />}
    </div>
  );
}
