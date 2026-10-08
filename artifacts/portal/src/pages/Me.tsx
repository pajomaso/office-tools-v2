import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Copy, Eye, EyeOff, KeyRound, Wifi } from "lucide-react";
import { Link } from "wouter";
import { api, type Area, type Me, type MyTag } from "@/lib/api";
import { Badge, Button, Card, PageHeader, Skeleton } from "@/components/ui";
import { reqKind, reqStatus } from "@/pages/Tags";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button variant="outline" aria-label={label} disabled={!value} onClick={() => navigator.clipboard.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}>
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}<span>{done ? "Copied" : "Copy"}</span>
    </Button>
  );
}

function Reveal({ label, shown, onToggle, value, empty }: { label: string; shown: boolean; onToggle: () => void; value: string | null | undefined; empty: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--ink-mute)]">{label}</dt>
      <dd className="mt-1 flex items-center gap-2">
        <span className="mono min-w-20 text-lg tracking-wider" aria-live="polite">{!shown ? "••••" : value ?? <span className="font-sans text-xs text-[var(--warn)]">{empty}</span>}</span>
        <button type="button" onClick={onToggle} aria-pressed={shown} aria-label={`${shown ? "Hide" : "Show"} ${label.toLowerCase()}`} className="grid size-8 place-items-center rounded-md text-[var(--ink-mute)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] cursor-pointer">
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </dd>
    </div>
  );
}

function TagCard() {
  const qc = useQueryClient();
  const my = useQuery({ queryKey: ["my-tag"], queryFn: () => api<MyTag>("/my-tag") });
  const [showNumber, setShowNumber] = useState(false), [showCode, setShowCode] = useState(false);
  // The number and code are only fetched once you ask to see them, and never kept in the page's cache.
  const secret = useQuery({ queryKey: ["my-tag-code"], queryFn: () => api<{ number: string | null; code: string | null; active: boolean }>("/my-tag/code"), enabled: showNumber || showCode, gcTime: 0, staleTime: 0 });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["my-tag"] }); qc.invalidateQueries({ queryKey: ["items"] }); };
  const ask = useMutation({ mutationFn: () => api("/tag-requests", { method: "POST", json: {} }), onSuccess: refresh });
  const newCode = useMutation({ mutationFn: () => api("/me/request-code", { method: "POST" }), onSuccess: refresh });
  if (my.isLoading || !my.data) return <Skeleton className="h-40" />;
  const open = my.data.requests.find((r) => r.status === "to_send" || r.status === "sent");
  const last = my.data.requests[0];
  const hasTag = !!my.data.tag || !!open?.newTagNumber;
  const err = ask.error ?? newCode.error;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2 text-base font-semibold"><KeyRound className="size-4" />My tag</div>
      {hasTag ? (
        <dl className="grid gap-4 sm:grid-cols-2">
          <Reveal label="Tag number" shown={showNumber} onToggle={() => setShowNumber(!showNumber)} value={secret.data?.number ?? my.data.tag?.number} empty={secret.isLoading ? "…" : "Not available"} />
          <Reveal label="Code" shown={showCode} onToggle={() => setShowCode(!showCode)} value={secret.data?.code} empty={secret.isLoading ? "…" : "Not set yet — ask an admin"} />
        </dl>
      ) : <p className="text-sm text-[var(--ink-soft)]">You don't have a tag yet.</p>}
      {open && (
        <p className="mt-4 rounded-md bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-soft)]">
          <Badge tone="brand">{reqStatus[open.status]}</Badge> <span className="ml-1">{reqKind[open.kind]}{open.newTagNumber ? ` (tag ${showNumber && secret.data?.number ? secret.data.number : "••••"})` : ""}. It may not work at the door until the supplier confirms it.</span>
        </p>
      )}
      {!open && last?.status === "rejected" && <p className="mt-4 text-sm text-[var(--danger)]">Your last tag request was rejected. Ask an admin.</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {!open && <Button variant="outline" disabled={ask.isPending} onClick={() => confirm(my.data.tag ? "Report your tag as lost and request a replacement?" : "Request an access tag?") && ask.mutate()}>{my.data.tag ? "I lost my tag" : "Request a tag"}</Button>}
        {hasTag && <Button variant="outline" disabled={newCode.isPending || newCode.isSuccess} onClick={() => confirm("Ask an admin for a new door code?") && newCode.mutate()}>{newCode.isSuccess ? "Code requested ✓" : "Request a new code"}</Button>}
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{err.message}</p>}
    </Card>
  );
}

export default function MePage({ me }: { me: Me }) {
  const area = useQuery({ queryKey: ["area"], queryFn: () => api<Area>("/area") });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Personal area" subtitle={`${me.name} · ${me.email}${me.company ? ` · ${me.company}` : ""}`} actions={<Link href="/app/account" className="inline-flex h-8 items-center rounded-md border border-[var(--line-strong)] px-3 text-sm font-medium hover:bg-[var(--surface-2)]">Account and password</Link>} />
      <TagCard />

      <Card>
        <div className="flex items-center gap-2 px-5 pt-4 pb-3 text-base font-semibold"><Wifi className="size-4" />WiFi</div>
        <div className="grid grid-cols-1 gap-3 px-5 pb-4 lg:grid-cols-2">
          {!area.data ? <Skeleton className="h-24" /> : area.data.wifi.map((w) => (
            <div key={w.ssid} className="rounded-[var(--r-md)] border border-[var(--line)] p-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">{w.label}</span>{w.internal && <Badge tone="brand">Subvisual</Badge>}</div>
              <dl className="grid grid-cols-[80px_1fr_auto] items-center gap-x-2 gap-y-1.5 text-sm">
                <dt className="text-xs uppercase tracking-wide text-[var(--ink-mute)]">Network</dt><dd className="truncate">{w.ssid}</dd><dd><CopyButton value={w.ssid} label={`Copy ${w.label} network name`} /></dd>
                <dt className="text-xs uppercase tracking-wide text-[var(--ink-mute)]">Password</dt><dd className="mono truncate">{w.password || <span className="font-sans text-xs text-[var(--warn)]">Not set — ask an admin.</span>}</dd><dd><CopyButton value={w.password} label={`Copy ${w.label} password`} /></dd>
              </dl>
              {w.note && <p className="mt-2 text-xs text-[var(--ink-mute)]">{w.note}</p>}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="px-5 pt-4 pb-2 text-base font-semibold">Guides</div>
        <div className="divide-y divide-[var(--line)]">
          {area.data?.guides.map((g) => (
            <details key={g.id} className="group px-5 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">{g.title}<ChevronDown className="size-4 text-[var(--ink-mute)] transition-transform group-open:rotate-180" /></summary>
              <p className="mt-2 whitespace-pre-line text-sm text-[var(--ink-soft)]">{g.body}</p>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
