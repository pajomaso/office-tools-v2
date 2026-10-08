import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Download, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { api, type AdminClient } from "@/lib/api";
import { Badge, Button, Card, PageHeader, Skeleton, fieldInput, fieldLabel } from "@/components/ui";
import { euro, monthLabel } from "@/pages/Invoices";
import { todayStr } from "@/lib/time";

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const refresh = (qc: ReturnType<typeof useQueryClient>) => ["admin-clients", "inbox-count", "inbox-todo", "admin-tags"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

function Field({ id, label, ...p }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <div><label className={fieldLabel} htmlFor={id}>{label}</label><input id={id} className={fieldInput} {...p} /></div>;
}

function ClientCard({ c }: { c: AdminClient }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: c.name, plan: c.plan, deskDaysPerMonth: c.deskDaysPerMonth?.toString() ?? "", roomDaysPerMonth: c.roomDaysPerMonth?.toString() ?? "",
    priceEuro: c.priceCents == null ? "" : (c.priceCents / 100).toString(), legalName: c.legalName ?? "", vatNumber: c.vatNumber ?? "", billingAddress: c.billingAddress ?? "", billingContact: c.billingContact ?? "",
  });
  const [inv, setInv] = useState<{ period: string; number: string; amount: string; file: File | null }>({ period: todayStr().slice(0, 7), number: "", amount: "", file: null });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const save = useMutation({
    mutationFn: () => api(`/admin/clients/${c.id}`, { method: "PATCH", json: {
      name: f.name, plan: f.plan, deskDaysPerMonth: num(f.deskDaysPerMonth), roomDaysPerMonth: num(f.roomDaysPerMonth),
      priceCents: f.priceEuro.trim() === "" ? null : Math.round(Number(f.priceEuro.replace(",", ".")) * 100),
      legalName: f.legalName, vatNumber: f.vatNumber, billingAddress: f.billingAddress, billingContact: f.billingContact } }),
    onSuccess: () => refresh(qc),
  });
  const upload = useMutation({
    mutationFn: () => {
      const body = new FormData();
      body.set("file", inv.file!); body.set("period", inv.period); body.set("number", inv.number); body.set("amount", inv.amount);
      return api(`/admin/clients/${c.id}/invoices`, { method: "POST", body });
    },
    onSuccess: () => { setInv({ ...inv, number: "", amount: "", file: null }); refresh(qc); },
  });
  const del = useMutation({ mutationFn: (id: string) => api(`/admin/invoices/${id}`, { method: "DELETE" }), onSuccess: () => refresh(qc) });

  return (
    <Card>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left cursor-pointer">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{c.name}</span>{c.role === "manager" && <Badge>Manager</Badge>}{c.invoiceDue && <Badge tone="brand">Invoice due</Badge>}</div>
          <div className="mt-0.5 truncate text-xs text-[var(--ink-mute)]">{c.email} · {c.plan} · desks {c.deskDaysPerMonth ?? "∞"} / rooms {c.roomDaysPerMonth ?? "∞"} days per month{c.tag ? ` · tag ${c.tag}` : ""}</div>
        </div>
        <ChevronDown className={clsx("size-4 shrink-0 text-[var(--ink-mute)] transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="grid gap-6 border-t border-[var(--line)] px-5 py-4 lg:grid-cols-2">
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <h3 className="text-sm font-semibold">Plan and billing record</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field id={`n-${c.id}`} label="Name" value={f.name} onChange={set("name")} required />
              <Field id={`p-${c.id}`} label="Plan" value={f.plan} onChange={set("plan")} />
              <Field id={`d-${c.id}`} label="Desk days / month" inputMode="numeric" placeholder="No limit" value={f.deskDaysPerMonth} onChange={set("deskDaysPerMonth")} />
              <Field id={`r-${c.id}`} label="Room days / month" inputMode="numeric" placeholder="No limit" value={f.roomDaysPerMonth} onChange={set("roomDaysPerMonth")} />
              <Field id={`pr-${c.id}`} label="Monthly price (€)" inputMode="decimal" placeholder="Not billed" value={f.priceEuro} onChange={set("priceEuro")} />
              <Field id={`v-${c.id}`} label="VAT number" value={f.vatNumber} onChange={set("vatNumber")} />
            </div>
            <Field id={`l-${c.id}`} label="Legal name" value={f.legalName} onChange={set("legalName")} />
            <Field id={`a-${c.id}`} label="Billing address" value={f.billingAddress} onChange={set("billingAddress")} />
            <Field id={`bc-${c.id}`} label="Billing contact" value={f.billingContact} onChange={set("billingContact")} />
            {save.isError && <p role="alert" className="text-sm text-[var(--danger)]">{save.error.message}</p>}
            <div className="flex items-center gap-3"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>{save.isSuccess && <span className="text-xs text-[var(--ok)]">Saved</span>}</div>
          </form>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Invoices</h3>
            {c.invoices.length ? (
              <ul className="divide-y divide-[var(--line)] rounded-[var(--r-md)] border border-[var(--line)]">
                {c.invoices.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{monthLabel(i.period)}{i.number && ` · ${i.number}`}{i.amountCents != null && ` · ${euro(i.amountCents)}`}</span>
                    <span className="flex shrink-0 gap-1">
                      <a aria-label="Download invoice" href={`/api/portal/invoices/${i.id}/file`} className="grid size-7 place-items-center rounded-md hover:bg-[var(--surface-2)]"><Download className="size-3.5" /></a>
                      <button aria-label="Delete invoice" className="grid size-7 place-items-center rounded-md text-[var(--danger)] hover:bg-[var(--surface-2)] cursor-pointer" onClick={() => confirm(`Delete the ${monthLabel(i.period)} invoice?`) && del.mutate(i.id)}><Trash2 className="size-3.5" /></button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[var(--ink-mute)]">No invoices uploaded yet.</p>}
            <form className="flex flex-col gap-3 rounded-[var(--r-md)] bg-[var(--surface-2)] p-3" onSubmit={(e) => { e.preventDefault(); upload.mutate(); }}>
              <div className="grid grid-cols-3 gap-3">
                <Field id={`im-${c.id}`} label="Month" type="month" required value={inv.period} onChange={(e) => setInv({ ...inv, period: e.target.value })} />
                <Field id={`in-${c.id}`} label="Number" placeholder="FT 2026/12" value={inv.number} onChange={(e) => setInv({ ...inv, number: e.target.value })} />
                <Field id={`ia-${c.id}`} label="Amount (€)" inputMode="decimal" value={inv.amount} onChange={(e) => setInv({ ...inv, amount: e.target.value })} />
              </div>
              <div><label className={fieldLabel} htmlFor={`if-${c.id}`}>PDF</label><input id={`if-${c.id}`} type="file" accept="application/pdf" required className="text-sm" onChange={(e) => setInv({ ...inv, file: e.target.files?.[0] ?? null })} /></div>
              {(upload.isError || del.isError) && <p role="alert" className="text-sm text-[var(--danger)]">{(upload.error ?? del.error)!.message}</p>}
              <div><Button type="submit" disabled={upload.isPending || !inv.file}>{upload.isPending ? "Uploading…" : "Upload invoice"}</Button></div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function Clients() {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ["admin-clients"], queryFn: () => api<AdminClient[]>("/admin/clients") });
  const [show, setShow] = useState(false);
  const [n, setN] = useState({ name: "", email: "", plan: "", deskDaysPerMonth: "", roomDaysPerMonth: "" });
  const add = useMutation({
    mutationFn: () => api("/admin/clients", { method: "POST", json: { ...n, deskDaysPerMonth: num(n.deskDaysPerMonth), roomDaysPerMonth: num(n.roomDaysPerMonth) } }),
    onSuccess: () => { setN({ name: "", email: "", plan: "", deskDaysPerMonth: "", roomDaysPerMonth: "" }); setShow(false); refresh(qc); },
  });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clients" subtitle="Tenants, plans, billing details and invoices. Invoices are issued elsewhere; upload the PDF here."
        actions={<Button onClick={() => setShow(!show)}><Plus className="size-4" />Add client</Button>} />
      {show && (
        <Card className="p-5">
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <Field id="nc-name" label="Name" required value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
            <Field id="nc-email" label="Email" type="email" required value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} />
            <Field id="nc-plan" label="Plan" placeholder="Members" value={n.plan} onChange={(e) => setN({ ...n, plan: e.target.value })} />
            <Field id="nc-d" label="Desk days / month" inputMode="numeric" placeholder="No limit" value={n.deskDaysPerMonth} onChange={(e) => setN({ ...n, deskDaysPerMonth: e.target.value })} />
            <Field id="nc-r" label="Room days / month" inputMode="numeric" placeholder="No limit" value={n.roomDaysPerMonth} onChange={(e) => setN({ ...n, roomDaysPerMonth: e.target.value })} />
            <Button type="submit" disabled={add.isPending}>Create</Button>
          </form>
          <p className="mt-2 text-xs text-[var(--ink-mute)]">They sign in with a one-time link sent to this email — there's no separate invite step.</p>
          {add.isError && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{add.error.message}</p>}
        </Card>
      )}
      {clients.isLoading ? <Skeleton className="h-40" /> : <div className="flex flex-col gap-3">{clients.data?.map((c) => <ClientCard key={c.id} c={c} />)}</div>}
    </div>
  );
}
