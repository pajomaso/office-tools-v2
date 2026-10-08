import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, type AdminClient } from "@/lib/api";
import { Badge, Button, Card, PageHeader, Skeleton, fieldInput, fieldLabel } from "@/components/ui";

export default function Clients() {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ["admin-clients"], queryFn: () => api<AdminClient[]>("/admin/clients") });
  const [show, setShow] = useState(false);
  const [n, setN] = useState({ name: "", email: "" });
  const add = useMutation({
    mutationFn: () => api("/admin/clients", { method: "POST", json: n }),
    onSuccess: () => { setN({ name: "", email: "" }); setShow(false); qc.invalidateQueries({ queryKey: ["admin-clients"] }); },
  });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Users" subtitle="Everyone who uses the office." actions={<Button onClick={() => setShow(!show)}><Plus className="size-4" />Add user</Button>} />
      {show && (
        <Card className="p-5">
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <div><label className={fieldLabel} htmlFor="nc-name">Name</label><input id="nc-name" required className={fieldInput} value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></div>
            <div><label className={fieldLabel} htmlFor="nc-email">Email</label><input id="nc-email" type="email" required className={fieldInput} value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} /></div>
            <Button type="submit" disabled={add.isPending}>Create</Button>
          </form>
          {add.isError && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{add.error.message}</p>}
        </Card>
      )}
      {clients.isLoading ? <Skeleton className="h-40" /> : (
        <Card>
          <ul className="divide-y divide-[var(--line)]">
            {clients.data?.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{c.name}</span>{c.role === "manager" && <Badge>Admin</Badge>}</div><div className="truncate text-xs text-[var(--ink-mute)]">{c.email}</div></div>
                <span className="mono text-sm text-[var(--ink-soft)]">{c.tag ?? "—"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
