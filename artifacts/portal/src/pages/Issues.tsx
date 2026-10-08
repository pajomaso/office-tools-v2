import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, type Item, type Me, type Supplier } from "@/lib/api";
import { Badge, Button, EmptyState, PageHeader, Skeleton, fieldCompact } from "@/components/ui";
import { itemKind } from "@/lib/labels";
import { fmtDay, ymd } from "@/lib/time";

const COLUMNS = [
  { key: "open", title: "Open", hint: "Nobody has picked these up yet" },
  { key: "claimed", title: "Claimed", hint: "An admin is on it" },
  { key: "done", title: "Done", hint: "Finished in the last 30 days" },
] as const;

function Card({ i, me, suppliers }: { i: Item; me: Me; suppliers: Supplier[] }) {
  const qc = useQueryClient();
  const [note, setNote] = useState(i.statusNote);
  const patch = useMutation({
    mutationFn: (b: object) => api(`/admin/items/${i.id}`, { method: "PATCH", json: b }),
    onSuccess: () => ["items", "inbox-count"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });
  const mine = i.claimedBy === me.id;
  return (
    <li className="rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-center gap-1.5"><Badge>{itemKind[i.kind]}</Badge>{i.visibility === "private" && <Badge>Private</Badge>}</div>
      <p className="mt-1.5 text-sm font-semibold">{i.title}</p>
      {i.body && <p className="mt-0.5 whitespace-pre-line text-xs text-[var(--ink-soft)]">{i.body}</p>}
      <p className="mt-1.5 text-[11px] text-[var(--ink-mute)]">{i.author} · {fmtDay(ymd(i.createdAt), { day: "numeric", month: "short" })}{i.claimedByName ? ` · ${mine ? "you" : i.claimedByName}` : ""}{i.followers > 1 ? ` · ${i.followers} following` : ""}</p>
      <div className="mt-2 flex flex-col gap-1.5">
        <label className="sr-only" htmlFor={`n-${i.id}`}>Status note</label>
        <div className="flex gap-1.5">
          <input id={`n-${i.id}`} className={`${fieldCompact} min-w-0 flex-1`} placeholder="Status note (called, not called yet…)" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button variant="outline" disabled={patch.isPending || note === i.statusNote} onClick={() => patch.mutate({ statusNote: note })}>Save</Button>
        </div>
        <label className="sr-only" htmlFor={`s-${i.id}`}>Supplier</label>
        <select id={`s-${i.id}`} className={fieldCompact} value={i.supplierId ?? ""} disabled={patch.isPending} onChange={(e) => patch.mutate({ supplierId: e.target.value || null })}>
          <option value="">No supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.what ? ` · ${s.what}` : ""}</option>)}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {i.status === "open" && <Button disabled={patch.isPending} onClick={() => patch.mutate({ claim: true })}>Claim</Button>}
          {i.status === "claimed" && <><Button disabled={patch.isPending} onClick={() => patch.mutate({ status: "done" })}>Mark done</Button>{mine ? <Button variant="outline" disabled={patch.isPending} onClick={() => patch.mutate({ claim: false })}>Release</Button> : <Button variant="outline" disabled={patch.isPending} onClick={() => patch.mutate({ claim: true })}>Take over</Button>}</>}
          {i.status === "done" && <Button variant="outline" disabled={patch.isPending} onClick={() => patch.mutate({ status: i.claimedBy ? "claimed" : "open" })}>Reopen</Button>}
        </div>
      </div>
      {patch.isError && <p role="alert" className="mt-1 text-xs text-[var(--danger)]">{patch.error.message}</p>}
    </li>
  );
}

export default function Issues({ me }: { me: Me }) {
  const items = useQuery({ queryKey: ["items"], queryFn: () => api<Item[]>("/items"), refetchInterval: 60_000 });
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: () => api<Supplier[]>("/admin/suppliers") });
  const [kind, setKind] = useState<"all" | "issue" | "request">("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const shown = (items.data ?? []).filter((i) => (kind === "all" || i.kind === kind) && (!onlyMine || i.claimedBy === me.id));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Issues and requests" subtitle="Claim an item to say you're on it, add a short status note, and move it to Done when it's finished. Everyone can see the status; nobody gets a notification." />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-[var(--surface-2)] p-1" role="tablist" aria-label="Type">
          {([["all", "All"], ["issue", "Issues"], ["request", "Requests"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={clsx("rounded-md px-3 py-1 text-sm font-medium cursor-pointer", kind === k ? "bg-[var(--surface)] shadow-[var(--shadow-sm)]" : "text-[var(--ink-soft)]")}>{l}</button>)}
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />Only mine</label>
      </div>
      {items.isLoading ? <Skeleton className="h-64" /> : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((c) => {
            const col = shown.filter((i) => i.status === c.key);
            return (
              <section key={c.key} aria-label={c.title} className="rounded-[var(--r-lg)] bg-[var(--surface-2)] p-3">
                <div className="mb-2 flex items-baseline justify-between"><h2 className="text-sm font-semibold">{c.title} <span className="tnum font-normal text-[var(--ink-mute)]">({col.length})</span></h2></div>
                <p className="mb-2 text-xs text-[var(--ink-mute)]">{c.hint}</p>
                {col.length ? <ul className="flex flex-col gap-2">{col.map((i) => <Card key={i.id + i.updatedAt} i={i} me={me} suppliers={suppliers.data ?? []} />)}</ul> : <EmptyState title={c.key === "open" ? "All picked up" : "Nothing here"} />}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
