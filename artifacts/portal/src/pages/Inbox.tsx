import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { api, type Item, type Me, type Todo } from "@/lib/api";
import { Badge, Button, EmptyState, PageHeader, Skeleton, fieldInput, fieldCompact } from "@/components/ui";
import { itemKind, itemStatus } from "@/lib/labels";
import { fmtDay, ymd } from "@/lib/time";
import { reqKind, reqStatus } from "@/pages/Tags";

function Row({ i, me }: { i: Item; me: Me }) {
  const qc = useQueryClient();
  const [note, setNote] = useState(i.statusNote);
  const patch = useMutation({
    mutationFn: (b: object) => api(`/admin/items/${i.id}`, { method: "PATCH", json: b }),
    onSuccess: () => ["items", "inbox-count"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });
  return (
    <li className="rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2"><Badge>{itemKind[i.kind]}</Badge>{i.visibility === "private" && <Badge>Private</Badge>}<span className="truncate text-sm font-semibold">{i.title}</span></div>
        <select aria-label="Status" className={`${fieldCompact} w-32`} value={i.status} disabled={patch.isPending} onChange={(e) => patch.mutate({ status: e.target.value })}>{Object.entries(itemStatus).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      {i.body && <p className="mt-1 whitespace-pre-line text-xs text-[var(--ink-soft)]">{i.body}</p>}
      <p className="mt-1 text-[11px] text-[var(--ink-mute)]">{i.author} · {fmtDay(ymd(i.createdAt), { day: "numeric", month: "short" })} · {i.claimedByName ? `claimed by ${i.claimedBy === me.id ? "you" : i.claimedByName}` : "unclaimed"}</p>
      <div className="mt-2 flex gap-2">
        {i.claimedBy === me.id ? <Button variant="outline" disabled={patch.isPending} onClick={() => patch.mutate({ claim: false })}>Release</Button> : <Button variant="outline" disabled={patch.isPending} onClick={() => patch.mutate({ claim: true })}>{i.claimedBy ? "Take over" : "Claim"}</Button>}
        <input className={fieldInput} placeholder="Short status note (e.g. called, not called yet)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button variant="outline" disabled={patch.isPending || note === i.statusNote} onClick={() => patch.mutate({ statusNote: note })}>Save</Button>
      </div>
      {patch.isError && <p role="alert" className="mt-1 text-sm text-[var(--danger)]">{patch.error.message}</p>}
    </li>
  );
}

export default function Inbox({ me }: { me: Me }) {
  const items = useQuery({ queryKey: ["items"], queryFn: () => api<Item[]>("/items") });
  const todo = useQuery({ queryKey: ["inbox-todo"], queryFn: () => api<Todo>("/inbox/todo") });
  const unclaimed = items.data?.filter((i) => i.status === "open" && !i.claimedBy) ?? [];
  const mine = items.data?.filter((i) => i.status !== "done" && !unclaimed.includes(i)) ?? [];
  const done = items.data?.filter((i) => i.status === "done") ?? [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inbox" subtitle="Everything that is waiting on an admin: unclaimed issues and requests, and tag changes for the supplier." />
      {items.isLoading ? <Skeleton className="h-40" /> : (
        <>
          {!!todo.data?.tagRequests.length && (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Tag changes ({todo.data.tagRequests.length})</h2>
              <ul className="flex flex-col gap-2">{todo.data.tagRequests.map((r) => (
                <li key={r.id}><Link href="/app/tags" className="flex items-center justify-between gap-3 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--line-strong)]">
                  <span className="text-sm"><span className="font-semibold">{r.client}</span> <span className="text-[var(--ink-mute)]">· {reqKind[r.kind]}</span></span><Badge tone="brand">{reqStatus[r.status]}</Badge>
                </Link></li>
              ))}</ul>
            </section>
          )}
          <section><h2 className="mb-3 text-sm font-semibold">Unclaimed ({unclaimed.length})</h2>{unclaimed.length ? <ul className="flex flex-col gap-2">{unclaimed.map((i) => <Row key={i.id + i.updatedAt} i={i} me={me} />)}</ul> : <EmptyState title="All clear" body="Everything has been picked up." />}</section>
          {!!mine.length && <section><h2 className="mb-3 text-sm font-semibold">Claimed ({mine.length})</h2><ul className="flex flex-col gap-2">{mine.map((i) => <Row key={i.id + i.updatedAt} i={i} me={me} />)}</ul></section>}
          {!!done.length && <section><h2 className="mb-3 text-sm font-semibold">Done (last 30 days)</h2><ul className="flex flex-col gap-2">{done.map((i) => <Row key={i.id + i.updatedAt} i={i} me={me} />)}</ul></section>}
        </>
      )}
    </div>
  );
}
