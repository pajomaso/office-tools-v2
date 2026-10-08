import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Report } from "@/lib/api";
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, fieldInput, fieldLabel } from "@/components/ui";
import { fmtDay, ymd } from "@/lib/time";
import clsx from "clsx";

export const statusLabel = { open: "Open", in_progress: "In progress", done: "Done" } as const;
export const kindLabel = { issue: "Broken", supply: "Missing" } as const;

export default function ReportPage() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<"issue" | "supply">("issue");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const reports = useQuery({ queryKey: ["reports"], queryFn: () => api<Report[]>("/reports") });
  const refresh = () => ["reports", "summary"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const send = useMutation({
    mutationFn: () => api("/reports", { method: "POST", json: { kind, title, details } }),
    onSuccess: () => { setTitle(""); setDetails(""); refresh(); },
  });
  // Opening this page counts as seeing the updates.
  const seen = useMutation({ mutationFn: () => api("/reports/seen", { method: "POST" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["summary"] }) });
  useEffect(() => {
    if (!reports.data?.some((r) => r.updated)) return;
    const t = setTimeout(() => seen.mutate(), 2500);
    return () => clearTimeout(t);
  }, [reports.data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Report" subtitle="Something broken or running low? Tell us in a few seconds and follow it here." />
      <Card className="p-5">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
          <div className="flex gap-1 self-start rounded-lg bg-[var(--surface-2)] p-1">
            {(["issue", "supply"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={clsx("rounded-md px-3 py-1 text-sm font-medium cursor-pointer", kind === k ? "bg-[var(--surface)] shadow-[var(--shadow-sm)]" : "text-[var(--ink-soft)]")}>
                {k === "issue" ? "Something's broken" : "Something's missing"}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="rp-title" className={fieldLabel}>{kind === "issue" ? "What's wrong?" : "What's missing?"}</label>
            <input id="rp-title" required className={fieldInput} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "issue" ? "Projector in Room 1 won't turn on" : "Coffee capsules"} />
          </div>
          <div>
            <label htmlFor="rp-details" className={fieldLabel}>Details (optional)</label>
            <textarea id="rp-details" rows={2} className={clsx(fieldInput, "h-auto py-2")} value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          {send.isError && <p role="alert" className="text-sm text-[var(--danger)]">{send.error.message}</p>}
          <div><Button type="submit" disabled={send.isPending || !title.trim()}>{send.isPending ? "Sending…" : "Send report"}</Button></div>
        </form>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Your reports</h2>
        {reports.isLoading ? <Skeleton className="h-24" /> : reports.data?.length ? (
          <ul className="flex flex-col gap-2">
            {reports.data.map((r) => (
              <li key={r.id} className={clsx("rounded-[var(--r-lg)] border bg-[var(--surface)] px-4 py-3", r.updated ? "border-[var(--brand)]" : "border-[var(--line)]")}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge>{kindLabel[r.kind]}</Badge>
                    <span className="truncate text-sm font-semibold">{r.title}</span>
                  </div>
                  <Badge tone={r.status === "done" ? "neutral" : "brand"}>{statusLabel[r.status]}</Badge>
                </div>
                {r.details && <p className="mt-1 text-xs text-[var(--ink-soft)]">{r.details}</p>}
                {r.managerNote && <p className="mt-2 rounded-md bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink-soft)]"><span className="font-semibold">Office manager:</span> {r.managerNote}</p>}
                <p className="mt-1.5 text-[11px] text-[var(--ink-mute)]">Sent {fmtDay(ymd(r.createdAt), { day: "numeric", month: "short" })}{r.updated && " · updated"}</p>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No reports yet" body="When you send one, you'll see its status here." />}
      </section>
    </div>
  );
}
