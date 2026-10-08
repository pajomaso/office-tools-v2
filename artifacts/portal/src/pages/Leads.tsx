import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Lead } from "@/lib/api";
import { Badge, Button, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { fmtDay, ymd } from "@/lib/time";

const interestLabel = { desk: "Desk", room: "Meeting room", other: "Something else" } as const;

function Row({ l }: { l: Lead }) {
  const qc = useQueryClient();
  const set = useMutation({
    mutationFn: () => api(`/admin/leads/${l.id}`, { method: "PATCH", json: { status: l.status === "new" ? "contacted" : "new" } }),
    onSuccess: () => ["leads", "inbox-count", "inbox-todo"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });
  return (
    <li className="rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{l.name}</span>{l.company && <span className="truncate text-sm text-[var(--ink-mute)]">· {l.company}</span>}<Badge>{interestLabel[l.interest]}</Badge></div>
          <a href={`mailto:${l.email}`} className="text-xs text-[var(--brand)] hover:underline">{l.email}</a>
          <span className="ml-2 text-[11px] text-[var(--ink-mute)]">{fmtDay(ymd(l.createdAt), { day: "numeric", month: "short" })}</span>
        </div>
        <Button variant={l.status === "new" ? "primary" : "outline"} disabled={set.isPending} onClick={() => set.mutate()}>{l.status === "new" ? "Mark contacted" : "Contacted ✓"}</Button>
      </div>
      {l.message && <p className="mt-1.5 whitespace-pre-line text-sm text-[var(--ink-soft)]">{l.message}</p>}
    </li>
  );
}

export default function Leads() {
  const { data, isLoading } = useQuery({ queryKey: ["leads"], queryFn: () => api<Lead[]>("/admin/leads") });
  const fresh = data?.filter((l) => l.status === "new") ?? [], old = data?.filter((l) => l.status !== "new") ?? [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Leads" subtitle="People who asked about the office through the public page." />
      {isLoading ? <Skeleton className="h-32" /> : data?.length ? (
        <>
          <section><h2 className="mb-3 text-sm font-semibold">To answer ({fresh.length})</h2>{fresh.length ? <ul className="flex flex-col gap-2">{fresh.map((l) => <Row key={l.id} l={l} />)}</ul> : <EmptyState title="All answered" />}</section>
          {!!old.length && <section><h2 className="mb-3 text-sm font-semibold">Contacted</h2><ul className="flex flex-col gap-2">{old.map((l) => <Row key={l.id} l={l} />)}</ul></section>}
        </>
      ) : <EmptyState title="No leads yet" body="They'll appear here when someone fills in the form on the public page." />}
    </div>
  );
}
