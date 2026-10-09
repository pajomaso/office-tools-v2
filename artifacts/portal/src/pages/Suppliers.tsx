import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Phone, Plus } from "lucide-react";
import { api, type Supplier } from "@/lib/api";
import { Button, Card, Dialog, EmptyState, PageHeader, Skeleton, fieldInput, fieldLabel } from "@/components/ui";
import { askConfirm } from "@/components/Confirm";

const blank = { name: "", what: "", contactName: "", phone: "", email: "", notes: "" };

function SupplierDialog({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState(supplier ? { name: supplier.name, what: supplier.what, contactName: supplier.contactName, phone: supplier.phone, email: supplier.email, notes: supplier.notes } : blank);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const save = useMutation({
    mutationFn: () => api(supplier ? `/admin/suppliers/${supplier.id}` : "/admin/suppliers", { method: supplier ? "PATCH" : "POST", json: f }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); qc.invalidateQueries({ queryKey: ["items"] }); onClose(); },
  });
  const del = useMutation({ mutationFn: () => api(`/admin/suppliers/${supplier!.id}`, { method: "DELETE" }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); qc.invalidateQueries({ queryKey: ["items"] }); onClose(); } });
  return (
    <Dialog title={supplier ? `Edit ${supplier.name}` : "New supplier"} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div><label className={fieldLabel} htmlFor="s-name">Name</label><input id="s-name" required autoFocus className={fieldInput} value={f.name} onChange={set("name")} /></div>
        <div><label className={fieldLabel} htmlFor="s-what">What they do</label><input id="s-what" className={fieldInput} placeholder="Electrician, cleaning, IT…" value={f.what} onChange={set("what")} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={fieldLabel} htmlFor="s-contact">Contact person</label><input id="s-contact" className={fieldInput} value={f.contactName} onChange={set("contactName")} /></div>
          <div><label className={fieldLabel} htmlFor="s-phone">Phone</label><input id="s-phone" type="tel" className={fieldInput} value={f.phone} onChange={set("phone")} /></div>
        </div>
        <div><label className={fieldLabel} htmlFor="s-email">Email</label><input id="s-email" type="email" className={fieldInput} value={f.email} onChange={set("email")} /></div>
        <div><label className={fieldLabel} htmlFor="s-notes">Notes</label><textarea id="s-notes" rows={3} className={`${fieldInput} h-auto py-2`} placeholder="Opening hours, contract, who to ask for…" value={f.notes} onChange={set("notes")} /></div>
        {(save.isError || del.isError) && <p role="alert" className="text-sm text-[var(--danger)]">{(save.error ?? del.error)!.message}</p>}
        <div className="flex items-center justify-between">
          <div>{supplier && <Button type="button" variant="outline" className="h-9 text-[var(--danger)]" disabled={del.isPending} onClick={() => askConfirm(`Delete ${supplier.name}? Issues that mention it will just lose the link.`).then((ok) => ok && del.mutate())}>Delete</Button>}</div>
          <div className="flex gap-2"><Button type="button" variant="outline" className="h-9" onClick={onClose}>Close</Button><Button type="submit" disabled={save.isPending}>Save</Button></div>
        </div>
      </form>
    </Dialog>
  );
}

export default function Suppliers() {
  const list = useQuery({ queryKey: ["suppliers"], queryFn: () => api<Supplier[]>("/admin/suppliers") });
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Suppliers" subtitle="Who to call when something needs fixing. You can attach one to an issue on the Issues board." actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" />New supplier</Button>} />
      {list.isLoading ? <Skeleton className="h-40" /> : list.data?.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.data.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><div className="text-sm font-semibold">{s.name}</div>{s.what && <div className="text-xs text-[var(--ink-soft)]">{s.what}</div>}</div>
                <Button variant="outline" onClick={() => setEditing(s)}>Edit</Button>
              </div>
              <div className="mt-3 flex flex-col gap-1 text-sm">
                {s.contactName && <div className="text-[var(--ink-soft)]">{s.contactName}</div>}
                {s.phone && <div className="flex items-center gap-2"><Phone className="size-3.5 text-[var(--ink-mute)]" /><a href={`tel:${s.phone.replace(/\s/g, "")}`} className="text-[var(--brand)] hover:underline">{s.phone}</a></div>}
                {s.email && <div className="flex items-center gap-2"><Mail className="size-3.5 text-[var(--ink-mute)]" /><a href={`mailto:${s.email}`} className="truncate text-[var(--brand)] hover:underline">{s.email}</a></div>}
                {s.notes && <p className="mt-1 whitespace-pre-line text-xs text-[var(--ink-mute)]">{s.notes}</p>}
              </div>
            </Card>
          ))}
        </div>
      ) : <EmptyState title="No suppliers yet" body="Add the people you call for electricity, cleaning, IT and so on." action={<Button onClick={() => setEditing("new")}>New supplier</Button>} />}
      {editing && <SupplierDialog supplier={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
