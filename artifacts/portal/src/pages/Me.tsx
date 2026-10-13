import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Copy, Eye, EyeOff, KeyRound, Wifi } from "lucide-react";
import { Link } from "wouter";
import { api, type Area, type Me, type MyTag } from "@/lib/api";
import { Badge, Button, Card, PageHeader, Skeleton } from "@/components/ui";
import { askConfirm } from "@/components/Confirm";

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

const pendingText = {
  assign: "Your tag is being set up. It may not work at the door until the supplier confirms it.",
  reassign: "Your tag is being set up. It may not work at the door until the supplier confirms it.",
  rename: "The name on your tag is being updated by the supplier.",
  lost: "Your tag is being deactivated by the supplier.",
  return: "Your tag is being returned.",
} as const;

function TagCard() {
  const qc = useQueryClient();
  const my = useQuery({ queryKey: ["my-tag"], queryFn: () => api<MyTag>("/my-tag") });
  const [showNumber, setShowNumber] = useState(false), [showCode, setShowCode] = useState(false);
  // The number and code are only fetched once you ask to see them, and never kept in the page's cache.
  const secret = useQuery({ queryKey: ["my-tag-code"], queryFn: () => api<{ number: string | null; code: string | null; active: boolean }>("/my-tag/code"), enabled: showNumber || showCode, gcTime: 0, staleTime: 0 });
  const [sent, setSent] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const saveCode = useMutation({
    mutationFn: () => api("/my-tag/code", { method: "POST", json: { code: newCode } }),
    onSuccess: () => { setNewCode(""); setShowCode(true); qc.invalidateQueries({ queryKey: ["my-tag"] }); qc.invalidateQueries({ queryKey: ["my-tag-code"] }); },
  });
  const ask = useMutation({ mutationFn: (kind: "new" | "lost" | "code") => api("/me/request", { method: "POST", json: { kind } }).then(() => kind), onSuccess: (k) => { setSent(k); qc.invalidateQueries({ queryKey: ["items"] }); } });
  if (my.isLoading || !my.data) return <Skeleton className="h-40" />;
  const { tag, pending } = my.data;
  const hasTag = !!tag || !!pending?.hasCode || pending?.kind === "assign" || pending?.kind === "reassign";
  const noCode = hasTag && !(tag ? tag.hasCode : pending?.hasCode);
  const sentText = { new: "Your request for a tag was sent to the admins.", lost: "The admins were told your tag is lost.", code: "The admins were asked for a new code." } as const;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2 text-base font-semibold"><KeyRound className="size-4" />My tag</div>
      {hasTag ? (
        <dl className="grid gap-4 sm:grid-cols-2">
          <Reveal label="Tag number" shown={showNumber} onToggle={() => setShowNumber(!showNumber)} value={secret.data?.number} empty={secret.isLoading ? "…" : "Not available"} />
          <Reveal label="Code" shown={showCode} onToggle={() => setShowCode(!showCode)} value={secret.data?.code} empty={secret.isLoading ? "…" : "Not set yet"} />
        </dl>
      ) : <p className="text-sm text-[var(--ink-soft)]">You don't have a tag yet.</p>}
      {noCode && (
        <form className="mt-4 flex flex-col gap-2 rounded-md bg-[var(--surface-2)] p-3" onSubmit={(e) => { e.preventDefault(); saveCode.mutate(); }}>
          <label htmlFor="own-code" className="text-sm font-medium">We don't have your door code yet. If you know it, add it here.</label>
          <p className="text-xs text-[var(--ink-mute)]">Only you and the admins can see it. This saves it in this tool; it doesn't change anything on the door system.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input id="own-code" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" placeholder="4 digits" value={newCode} onChange={(e) => setNewCode(e.target.value.replace(/\D/g, ""))} className="mono h-9 w-28 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm tracking-widest" />
            <Button type="submit" disabled={saveCode.isPending || newCode.length !== 4}>Save code</Button>
          </div>
          {saveCode.isError && <p role="alert" className="text-sm text-[var(--danger)]">{saveCode.error.message}</p>}
        </form>
      )}
      {tag?.status === "blocked" && <p className="mt-3 text-sm text-[var(--warn)]">Your tag is blocked. Ask an admin.</p>}
      {pending && <p className="mt-4 rounded-md bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-soft)]"><Badge tone="brand">Pending</Badge> <span className="ml-1">{pendingText[pending.kind]}</span></p>}
      {sent && <p role="status" className="mt-3 text-sm text-[var(--ok)]">{sentText[sent as keyof typeof sentText]}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {!hasTag && sent !== "new" && <Button variant="outline" disabled={ask.isPending} onClick={() => askConfirm("Ask the admins for an access tag?").then((ok) => ok && ask.mutate("new"))}>Request a tag</Button>}
        {tag && !pending && <Button variant="outline" disabled={ask.isPending} onClick={() => askConfirm("Tell the admins your tag is lost and ask for a replacement?").then((ok) => ok && ask.mutate("lost"))}>I lost my tag</Button>}
        {hasTag && <Button variant="outline" disabled={ask.isPending} onClick={() => askConfirm("Ask the admins for a new door code?").then((ok) => ok && ask.mutate("code"))}>Request a new code</Button>}
      </div>
      {ask.isError && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{ask.error.message}</p>}
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
