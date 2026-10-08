import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Square } from "lucide-react";
import { useRoute } from "wouter";
import { api, type SupplierLine } from "@/lib/api";
import { Button } from "@/components/ui";
import { levelLabel, lineText } from "@/lib/tags";
import { fmtDay, hm, ymd } from "@/lib/time";

type Data = { sentAt: string | null; expiresAt: string | null; lines: SupplierLine[] };

// The supplier's page. No sign-in: the secret link in the address is the credential. It only shows this one request.
export default function Access() {
  const [, params] = useRoute("/access/:token");
  const token = params?.token ?? "";
  const [lines, setLines] = useState<SupplierLine[] | null>(null);
  const [note, setNote] = useState("");
  const q = useQuery({ queryKey: ["access", token], queryFn: () => api<Data>(`/access/${token}`), retry: false });
  const shown = lines ?? q.data?.lines ?? [];
  const live = shown.filter((l) => l.status !== "removed");
  const pending = live.filter((l) => l.status === "pending");

  const one = useMutation({
    mutationFn: (id: string) => api<{ result: string; lines: SupplierLine[] }>(`/access/${token}/lines/${id}/done`, { method: "POST" }),
    onSuccess: (r) => { setLines(r.lines); setNote(r.result === "outdated" ? "That tag has changed since the request was made, so it was not applied. The office will be told." : ""); },
  });
  const all = useMutation({
    mutationFn: () => api<{ done: number; outdated: number; lines: SupplierLine[] }>(`/access/${token}/done-all`, { method: "POST" }),
    onSuccess: (r) => { setLines(r.lines); setNote(r.outdated ? `${r.done} done. ${r.outdated} could not be applied because the tag changed since: the office will be told.` : ""); },
  });
  const err = one.error ?? all.error;

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-10">
      <meta name="robots" content="noindex, nofollow" />
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-2 text-[var(--brand)]"><Square className="size-5 fill-current" /><span className="text-[17px] font-semibold tracking-tight text-[var(--ink)]">Office 42 · access tag request</span></div>
        {q.isLoading ? <p className="text-sm text-[var(--ink-mute)]">Loading…</p> : q.isError ? (
          <div role="alert" className="rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] p-5">
            <p className="font-semibold">This link doesn't work</p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{q.error.message}</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-[var(--ink-soft)]">
              Hello Ricardo. Please make these changes in your system, then press <b>Done</b> on each line{q.data?.sentAt ? ` (sent ${fmtDay(ymd(q.data.sentAt), { day: "numeric", month: "long" })})` : ""}.
            </p>
            <ul className="mt-5 flex flex-col gap-2">
              {live.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                  <div className="min-w-0">
                    <p className={l.status === "pending" ? "text-sm font-medium" : "text-sm text-[var(--ink-mute)] line-through"}>{lineText(l)}</p>
                    <p className="mt-0.5 text-xs text-[var(--ink-mute)]">Access level: {levelLabel[l.level]}</p>
                  </div>
                  {l.status === "pending" ? <Button disabled={one.isPending || all.isPending} onClick={() => one.mutate(l.id)}>Done</Button>
                    : l.status === "done" ? <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--ok)]"><Check className="size-4" />Done{l.doneAt ? ` ${hm(l.doneAt)}` : ""}</span>
                    : <span className="shrink-0 text-xs text-[var(--warn)]">Not applied: tag changed</span>}
                </li>
              ))}
            </ul>
            {note && <p role="status" className="mt-3 text-sm text-[var(--warn)]">{note}</p>}
            {err && <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{err.message}</p>}
            <div className="mt-5">
              {pending.length > 1 && <Button variant="outline" className="h-9" disabled={all.isPending} onClick={() => all.mutate()}>Mark all done ({pending.length})</Button>}
              {live.length > 0 && !pending.length && <p className="text-sm font-medium text-[var(--ok)]">Everything is done. Thank you!</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
