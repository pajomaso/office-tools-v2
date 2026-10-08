import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Pin, Trash2 } from "lucide-react";
import clsx from "clsx";
import { api, type Announcement, type Me } from "@/lib/api";
import { Button, Card, EmptyState, PageHeader, Skeleton, fieldInput, fieldLabel } from "@/components/ui";
import { fmtDay, ymd } from "@/lib/time";

export function AnnouncementItem({ a, manager, compact }: { a: Announcement; manager?: boolean; compact?: boolean }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["announcements"] });
  const pin = useMutation({ mutationFn: () => api(`/announcements/${a.id}`, { method: "PATCH", json: { pinned: !a.pinned } }), onSuccess: refresh });
  const del = useMutation({ mutationFn: () => api(`/announcements/${a.id}`, { method: "DELETE" }), onSuccess: refresh });
  return (
    <li className={clsx("rounded-[var(--r-lg)] border bg-[var(--surface)] px-4 py-3", a.pinned ? "border-[color-mix(in_oklch,var(--brand)_40%,transparent)] bg-[var(--brand-soft)]" : "border-[var(--line)]")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">{a.pinned && <Pin className="size-3.5 text-[var(--brand)]" />}<span className="text-sm font-semibold">{a.title}</span></div>
          {a.body && <p className={clsx("mt-1 whitespace-pre-line text-sm text-[var(--ink-soft)]", compact && "line-clamp-2")}>{a.body}</p>}
          <p className="mt-1.5 text-[11px] text-[var(--ink-mute)]">{a.author} · {fmtDay(ymd(a.createdAt), { day: "numeric", month: "short" })}</p>
        </div>
        {manager && (
          <div className="flex shrink-0 gap-1">
            <button aria-label={a.pinned ? "Unpin" : "Pin"} disabled={pin.isPending} onClick={() => pin.mutate()} className="grid size-7 place-items-center rounded-md text-[var(--ink-mute)] hover:bg-[var(--surface-2)] cursor-pointer"><Pin className="size-3.5" /></button>
            <button aria-label="Delete announcement" disabled={del.isPending} onClick={() => confirm(`Delete “${a.title}”?`) && del.mutate()} className="grid size-7 place-items-center rounded-md text-[var(--danger)] hover:bg-[var(--surface-2)] cursor-pointer"><Trash2 className="size-3.5" /></button>
          </div>
        )}
      </div>
    </li>
  );
}

export default function Announcements({ me }: { me: Me }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["announcements"], queryFn: () => api<Announcement[]>("/announcements") });
  const [f, setF] = useState({ title: "", body: "", pinned: false });
  const post = useMutation({ mutationFn: () => api("/announcements", { method: "POST", json: f }), onSuccess: () => { setF({ title: "", body: "", pinned: false }); qc.invalidateQueries({ queryKey: ["announcements"] }); } });
  const manager = me.role === "admin";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Announcements" subtitle="Official news from the office manager, for everyone in the office." />
      {manager && (
        <Card className="p-5">
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); post.mutate(); }}>
            <div><label className={fieldLabel} htmlFor="an-title">Title</label><input id="an-title" required maxLength={140} className={fieldInput} placeholder="Fire drill on Thursday at 11:00" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><label className={fieldLabel} htmlFor="an-body">Details (optional)</label><textarea id="an-body" rows={3} maxLength={2000} className={clsx(fieldInput, "h-auto py-2")} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]"><input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} className="size-4 accent-[var(--brand)]" />Highlight on everyone's home page</label>
            {post.isError && <p role="alert" className="text-sm text-[var(--danger)]">{post.error.message}</p>}
            <div><Button type="submit" disabled={post.isPending || !f.title.trim()}>{post.isPending ? "Publishing…" : "Publish"}</Button></div>
          </form>
        </Card>
      )}
      {list.isLoading ? <Skeleton className="h-32" /> : list.data?.length ? (
        <ul className="flex flex-col gap-2">{list.data.map((a) => <AnnouncementItem key={a.id} a={a} manager={manager} />)}</ul>
      ) : <EmptyState icon={<Megaphone className="size-5" />} title="No announcements" body="When the office manager shares something, it will show up here and on your home page." />}
    </div>
  );
}
