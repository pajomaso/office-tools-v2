import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { api, type Post } from "@/lib/api";
import { Button, Card, EmptyState, PageHeader, Skeleton, fieldInput } from "@/components/ui";
import { fmtDay, hm, ymd } from "@/lib/time";
import clsx from "clsx";

export default function Board() {
  const qc = useQueryClient();
  const posts = useQuery({ queryKey: ["posts"], queryFn: () => api<Post[]>("/posts"), refetchInterval: 60_000 });
  const [body, setBody] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["posts"] });
  const send = useMutation({ mutationFn: () => api("/posts", { method: "POST", json: { body } }), onSuccess: () => { setBody(""); refresh(); } });
  const del = useMutation({ mutationFn: (id: string) => api(`/posts/${id}`, { method: "DELETE" }), onSuccess: refresh });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Community board" subtitle="Lunch plans, a book to lend, a spare ticket. Keep it friendly — the office manager can remove posts." />
      <Card className="p-5">
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
          <label htmlFor="bd-body" className="sr-only">Your post</label>
          <textarea id="bd-body" rows={2} maxLength={500} className={clsx(fieldInput, "h-auto py-2")} placeholder="Share something with the office…" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex items-center justify-between">
            <span className="tnum text-xs text-[var(--ink-mute)]">{body.length}/500</span>
            <Button type="submit" disabled={send.isPending || !body.trim()}>{send.isPending ? "Posting…" : "Post"}</Button>
          </div>
          {send.isError && <p role="alert" className="text-sm text-[var(--danger)]">{send.error.message}</p>}
        </form>
      </Card>
      {posts.isLoading ? <Skeleton className="h-32" /> : posts.data?.length ? (
        <ul className="flex flex-col gap-2">
          {posts.data.map((p) => (
            <li key={p.id} className="rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="whitespace-pre-line break-words text-sm">{p.body}</p>
                  <p className="mt-1.5 text-[11px] text-[var(--ink-mute)]">{p.mine ? "You" : p.author} · {fmtDay(ymd(p.createdAt), { day: "numeric", month: "short" })} {hm(p.createdAt)}</p>
                </div>
                {p.canDelete && <button aria-label="Delete post" disabled={del.isPending} onClick={() => confirm("Delete this post?") && del.mutate(p.id)} className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--danger)] hover:bg-[var(--surface-2)] cursor-pointer"><Trash2 className="size-3.5" /></button>}
              </div>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="Nothing here yet" body="Be the first to post." />}
      {del.isError && <p role="alert" className="text-sm text-[var(--danger)]">{del.error.message}</p>}
    </div>
  );
}
