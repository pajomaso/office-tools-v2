import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { api, type AdminTags, type AdminUser, type TagRequest } from "@/lib/api";
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, fieldInput, fieldCompact, fieldLabel } from "@/components/ui";
import { fmtDay, ymd } from "@/lib/time";

export const reqStatus = { to_send: "To send", sent: "Sent to supplier", confirmed: "Confirmed", rejected: "Rejected" } as const;
export const reqKind = { new: "New tag", replace: "Replace lost tag", deactivate: "Deactivate" } as const;

function CodeCell({ tagId, number, hasCode }: { tagId: string; number: string; hasCode: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const save = useMutation({
    mutationFn: () => api(`/admin/tags/${tagId}/code`, { method: "PUT", json: { code } }),
    onSuccess: () => { setOpen(false); setCode(""); qc.invalidateQueries({ queryKey: ["admin-tags"] }); },
  });
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

function Request({ r, selected, onToggle }: { r: TagRequest; selected: boolean; onToggle: () => void }) {
  const qc = useQueryClient();
  const [num, setNum] = useState(r.newTagNumber ?? "");
  const done = () => ["admin-tags", "inbox-count", "inbox-todo", "admin-users"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const confirm = useMutation({ mutationFn: () => api(`/admin/tag-requests/${r.id}/confirm`, { method: "POST", json: { tagNumber: num } }), onSuccess: done });
  const reject = useMutation({ mutationFn: () => api(`/admin/tag-requests/${r.id}/reject`, { method: "POST" }), onSuccess: done });
  const err = confirm.error ?? reject.error;
  return (
    <li className="rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {r.status === "to_send" && <input type="checkbox" aria-label={`Select request from ${r.client}`} checked={selected} onChange={onToggle} className="size-4 accent-[var(--brand)]" />}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{r.client} <span className="font-normal text-[var(--ink-mute)]">· {reqKind[r.kind]}{r.oldNumber ? ` (tag ${r.oldNumber})` : ""}</span></div>
            <div className="text-xs text-[var(--ink-mute)]">{fmtDay(ymd(r.createdAt), { day: "numeric", month: "short" })}{r.note && ` · ${r.note}`}{r.newTagNumber && ` · new tag ${r.newTagNumber}`}</div>
          </div>
        </div>
        <Badge tone={r.status === "confirmed" || r.status === "rejected" ? "neutral" : "brand"}>{reqStatus[r.status]}</Badge>
      </div>
      {r.status === "sent" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {r.kind !== "deactivate" && <input className={`${fieldCompact} max-w-48`} placeholder="Number of the new tag" aria-label="New tag number" value={num} onChange={(e) => setNum(e.target.value)} />}
          <Button disabled={confirm.isPending || (r.kind !== "deactivate" && !num.trim())} onClick={() => confirm.mutate()}>Supplier confirmed</Button>
          <Button variant="outline" disabled={reject.isPending} onClick={() => reject.mutate()}>Reject</Button>
        </div>
      )}
      {r.status === "to_send" && <div className="mt-2"><Button variant="outline" disabled={reject.isPending} onClick={() => reject.mutate()}>Reject</Button></div>}
      {err && <p role="alert" className="mt-1 text-sm text-[var(--danger)]">{err.message}</p>}
    </li>
  );
}

export default function Tags() {
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["admin-tags"], queryFn: () => api<AdminTags>("/admin/tags") });
  const clients = useQuery({ queryKey: ["admin-users"], queryFn: () => api<AdminUser[]>("/admin/users") });
  const [sel, setSel] = useState<string[]>([]);
  const [imp, setImp] = useState({ number: "", clientId: "", access: "" });
  const [nr, setNr] = useState({ clientId: "", kind: "new" });
  const refresh = () => ["admin-tags", "inbox-count", "inbox-todo", "admin-users"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const markSent = useMutation({ mutationFn: () => api("/admin/tag-requests/mark-sent", { method: "POST", json: { ids: sel } }), onSuccess: () => { setSel([]); refresh(); } });
  const addTag = useMutation({ mutationFn: () => api("/admin/tags", { method: "POST", json: { ...imp, clientId: imp.clientId || null } }), onSuccess: () => { setImp({ number: "", clientId: "", access: "" }); refresh(); } });
  const addReq = useMutation({ mutationFn: () => api("/admin/tag-requests", { method: "POST", json: nr }), onSuccess: refresh });
  const saveAccess = useMutation({ mutationFn: ({ id, access }: { id: string; access: string }) => api(`/admin/tags/${id}`, { method: "PATCH", json: { access } }), onSuccess: refresh });

  const [sup, setSup] = useState<{ name: string; email: string } | null>(null);
  const supplierForm = sup ?? { name: data.data?.supplier?.name ?? "", email: data.data?.supplier?.email ?? "" };
  const saveSupplier = useMutation({ mutationFn: () => api("/admin/supplier", { method: "PUT", json: supplierForm }), onSuccess: () => { setSup(null); refresh(); } });

  const reqs = data.data?.requests ?? [];
  const open = reqs.filter((r) => r.status === "to_send" || r.status === "sent");
  const closed = reqs.filter((r) => r.status === "confirmed" || r.status === "rejected");
  const picked = reqs.filter((r) => sel.includes(r.id));
  const supplier = data.data?.supplier?.email ?? "";
  const mailto = () => {
    const body = ["Hello,", "", "Please process the following access tag requests for Office 42, Braga:", "",
      ...picked.map((r) => `- ${reqKind[r.kind]}: ${r.client}${r.oldNumber ? ` (current tag ${r.oldNumber})` : ""}${r.note ? ` — ${r.note}` : ""}`), "", "Thank you."].join("\n");
    return `mailto:${supplier}?subject=${encodeURIComponent("Access tag requests — Office 42")}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tags" subtitle="The source of truth for access tags. The supplier is contacted by email; a tag only changes here once they confirm." />
      {data.isLoading ? <Skeleton className="h-48" /> : (
        <>
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Requests in progress ({open.length})</h2>
              <div className="flex items-center gap-2">
                <a href={picked.length ? mailto() : undefined} aria-disabled={!picked.length}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line-strong)] px-3 text-sm font-medium ${picked.length ? "hover:bg-[var(--surface-2)]" : "pointer-events-none opacity-50"}`}>
                  <Mail className="size-3.5" />Prepare email ({picked.length})
                </a>
                <Button disabled={!picked.length || markSent.isPending} onClick={() => markSent.mutate()}>Mark as sent</Button>
              </div>
            </div>
            {!supplier && <p className="mb-2 text-xs text-[var(--warn)]">Supplier email not set — add it below and "Prepare email" will address it for you.</p>}
            {open.length ? <ul className="flex flex-col gap-2">{open.map((r) => <Request key={r.id + r.status} r={r} selected={sel.includes(r.id)} onToggle={() => setSel((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))} />)}</ul>
              : <EmptyState title="No requests in progress" />}
            {markSent.isError && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{markSent.error.message}</p>}
          </section>

          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold">Tag supplier</h2>
            <p className="mb-3 text-xs text-[var(--ink-mute)]">Used to address the request email. You can leave it empty until it's known.</p>
            <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); saveSupplier.mutate(); }}>
              <div><label className={fieldLabel} htmlFor="sup-name">Company</label><input id="sup-name" className={`${fieldCompact} w-56`} value={supplierForm.name} onChange={(e) => setSup({ ...supplierForm, name: e.target.value })} /></div>
              <div><label className={fieldLabel} htmlFor="sup-email">Email</label><input id="sup-email" type="email" className={`${fieldCompact} w-64`} placeholder="supplier@example.com" value={supplierForm.email} onChange={(e) => setSup({ ...supplierForm, email: e.target.value })} /></div>
              <Button type="submit" variant="outline" className="h-9" disabled={saveSupplier.isPending || sup === null}>{saveSupplier.isPending ? "Saving…" : "Save"}</Button>
              {saveSupplier.isSuccess && sup === null && <span className="pb-2 text-xs text-[var(--ok)]">Saved</span>}
            </form>
            {saveSupplier.isError && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{saveSupplier.error.message}</p>}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">New request</h2>
            <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); addReq.mutate(); }}>
              <div><label className={fieldLabel} htmlFor="nr-client">Client</label>
                <select id="nr-client" required className={`${fieldCompact} w-56`} value={nr.clientId} onChange={(e) => setNr({ ...nr, clientId: e.target.value })}>
                  <option value="">Select…</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <div><label className={fieldLabel} htmlFor="nr-kind">Type</label>
                <select id="nr-kind" className={`${fieldCompact} w-52`} value={nr.kind} onChange={(e) => setNr({ ...nr, kind: e.target.value })}>
                  {Object.entries(reqKind).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <Button type="submit" disabled={addReq.isPending || !nr.clientId}>Add to log</Button>
            </form>
            {addReq.isError && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{addReq.error.message}</p>}
          </Card>

          <section>
            <h2 className="mb-3 text-sm font-semibold">Tag database ({data.data?.tags.length ?? 0})</h2>
            <Card>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wide text-[var(--ink-mute)]"><th className="px-4 py-2 font-medium">Tag</th><th className="px-4 py-2 font-medium">Person</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Code</th><th className="px-4 py-2 font-medium">Access</th></tr></thead>
                <tbody>
                  {data.data?.tags.map((t) => (
                    <tr key={t.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="mono px-4 py-2">{t.number}</td>
                      <td className="px-4 py-2">{t.client ?? <span className="text-[var(--ink-mute)]">Unassigned</span>}</td>
                      <td className="px-4 py-2"><Badge tone={t.status === "active" ? "brand" : "neutral"}>{t.status}</Badge></td>
                      <td className="px-4 py-2"><CodeCell tagId={t.id} number={t.number} hasCode={!!t.hasCode} /></td>
                      <td className="px-4 py-2"><input aria-label={`Access for tag ${t.number}`} defaultValue={t.access} className="w-full bg-transparent outline-none focus:underline" onBlur={(e) => e.target.value !== t.access && saveAccess.mutate({ id: t.id, access: e.target.value })} placeholder="e.g. Front door, 24/7" /></td>
                    </tr>
                  ))}
                  {!data.data?.tags.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-[var(--ink-mute)]">No tags yet. Add the existing ones below.</td></tr>}
                </tbody>
              </table>
            </Card>
            <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); addTag.mutate(); }}>
              <div><label className={fieldLabel} htmlFor="imp-n">Existing tag</label><input id="imp-n" required className={`${fieldCompact} w-32`} value={imp.number} onChange={(e) => setImp({ ...imp, number: e.target.value })} placeholder="0042" /></div>
              <div><label className={fieldLabel} htmlFor="imp-c">Person</label>
                <select id="imp-c" className={`${fieldCompact} w-52`} value={imp.clientId} onChange={(e) => setImp({ ...imp, clientId: e.target.value })}><option value="">Unassigned</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className={fieldLabel} htmlFor="imp-a">Access</label><input id="imp-a" className={`${fieldCompact} w-56`} value={imp.access} onChange={(e) => setImp({ ...imp, access: e.target.value })} placeholder="Front door, 24/7" /></div>
              <Button type="submit" variant="outline" className="h-9" disabled={addTag.isPending}>Add tag</Button>
            </form>
            {addTag.isError && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{addTag.error.message}</p>}
          </section>

          {!!closed.length && (
            <section>
              <h2 className="mb-3 text-sm font-semibold">History</h2>
              <ul className="flex flex-col gap-2">{closed.map((r) => <Request key={r.id} r={r} selected={false} onToggle={() => {}} />)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
