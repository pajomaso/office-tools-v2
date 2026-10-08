import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { api, type Report, type Todo } from "@/lib/api";
import { Badge, Button, EmptyState, PageHeader, Skeleton, fieldInput } from "@/components/ui";
import { fmtDay, ymd } from "@/lib/time";
import { kindLabel, statusLabel } from "@/pages/Report";
import { reqKind, reqStatus } from "@/pages/Tags";

function Item({ r }: { r: Report }) {
  const qc = useQueryClient();
  const [note, setNote] = useState(r.managerNote);
  const patch = useMutation({
    mutationFn: (body: { status?: string; managerNote?: string }) => api(`/inbox/${r.id}`, { method: "PATCH", json: body }),
    onSuccess: () => ["inbox", "inbox-count"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });
  return (
    <li className="rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2"><Badge>{kindLabel[r.kind]}</Badge><span className="truncate text-sm font-semibold">{r.title}</span></div>
        <select aria-label="Status" className={`${fieldInput} w-36`} value={r.status} disabled={patch.isPending} onChange={(e) => patch.mutate({ status: e.target.value })}>
          {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {r.details && <p className="mt-1 text-xs text-[var(--ink-soft)]">{r.details}</p>}
      <p className="mt-1 text-[11px] text-[var(--ink-mute)]">{r.reporter} · {fmtDay(ymd(r.createdAt), { day: "numeric", month: "short" })}</p>
      <div className="mt-2 flex gap-2">
        <input className={fieldInput} placeholder="Reply to the reporter (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button variant="outline" disabled={patch.isPending || note === r.managerNote} onClick={() => patch.mutate({ managerNote: note })}>Save</Button>
      </div>
      {patch.isError && <p role="alert" className="mt-1 text-sm text-[var(--danger)]">{patch.error.message}</p>}
    </li>
  );
}

export default function Inbox() {
  const items = useQuery({ queryKey: ["inbox"], queryFn: () => api<Report[]>("/inbox") });
  const todo = useQuery({ queryKey: ["inbox-todo"], queryFn: () => api<Todo>("/inbox/todo") });
  const open = items.data?.filter((r) => r.status !== "done") ?? [];
  const done = items.data?.filter((r) => r.status === "done") ?? [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inbox" subtitle="Everything that needs the office manager, in one list: issues first, then supplies." />
      {items.isLoading ? <Skeleton className="h-40" /> : (
        <>
          {!!todo.data?.tagRequests.length && (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Tag requests ({todo.data.tagRequests.length})</h2>
              <ul className="flex flex-col gap-2">
                {todo.data.tagRequests.map((r) => (
                  <li key={r.id}><Link href="/app/tags" className="flex items-center justify-between gap-3 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--line-strong)]">
                    <span className="text-sm"><span className="font-semibold">{r.client}</span> <span className="text-[var(--ink-mute)]">· {reqKind[r.kind]}</span></span>
                    <Badge tone="brand">{reqStatus[r.status]}</Badge>
                  </Link></li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h2 className="mb-3 text-sm font-semibold">Pending ({open.length})</h2>
            {open.length ? <ul className="flex flex-col gap-2">{open.map((r) => <Item key={r.id + r.updatedAt} r={r} />)}</ul> : <EmptyState title="All clear" body="Nothing is waiting on you." />}
          </section>
          {!!done.length && (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Done</h2>
              <ul className="flex flex-col gap-2">{done.map((r) => <Item key={r.id + r.updatedAt} r={r} />)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
