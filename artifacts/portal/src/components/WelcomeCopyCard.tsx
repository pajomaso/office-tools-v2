import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "@/lib/api";
import { Button, Card, Skeleton, fieldInput, fieldLabel } from "@/components/ui";

export default function WelcomeCopyCard() {
  const qc = useQueryClient();
  const copy = useQuery({ queryKey: ["welcome-copy"], queryFn: () => api<{ subject: string; body: string }>("/admin/welcome-email") });
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const v = draft ?? copy.data;
  const save = useMutation({ mutationFn: () => api("/admin/welcome-email", { method: "PUT", json: v }), onSuccess: () => { setDraft(null); qc.invalidateQueries({ queryKey: ["welcome-copy"] }); } });
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold">Welcome email</h2>
      <p className="mb-3 mt-1 text-xs text-[var(--ink-mute)]">Placeholders: <code>{"{{name}}"}</code> <code>{"{{link}}"}</code> <code>{"{{tag}}"}</code> <code>{"{{code}}"}</code>. Remove <code>{"{{code}}"}</code> if you'd rather not email door codes. Text in [square brackets] still needs filling in.</p>
      {!v ? <Skeleton className="h-40" /> : (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div><label className={fieldLabel} htmlFor="we-sub">Subject</label><input id="we-sub" className={fieldInput} value={v.subject} onChange={(e) => setDraft({ ...v, subject: e.target.value })} /></div>
          <div><label className={fieldLabel} htmlFor="we-body">Text</label><textarea id="we-body" rows={14} className={clsx(fieldInput, "h-auto py-2 font-mono text-xs")} value={v.body} onChange={(e) => setDraft({ ...v, body: e.target.value })} /></div>
          {save.isError && <p role="alert" className="text-sm text-[var(--danger)]">{save.error.message}</p>}
          <div className="flex items-center gap-3"><Button type="submit" disabled={save.isPending || !draft}>Save</Button>{save.isSuccess && !draft && <span className="text-xs text-[var(--ok)]">Saved</span>}</div>
        </form>
      )}
    </Card>
  );
}

