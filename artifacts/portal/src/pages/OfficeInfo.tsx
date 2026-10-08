import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Wifi } from "lucide-react";
import { api, type Me, type MyTag, type Office } from "@/lib/api";
import { reqKind, reqStatus } from "@/pages/Tags";
import { Badge, Button, Card, PageHeader, Skeleton } from "@/components/ui";

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button variant="outline" disabled={!value} onClick={() => navigator.clipboard.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}>
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      <span>{done ? "Copied" : "Copy"}</span>
    </Button>
  );
}

function TagBlock() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["my-tag"], queryFn: () => api<MyTag>("/my-tag") });
  const ask = useMutation({ mutationFn: () => api("/tag-requests", { method: "POST", json: {} }), onSuccess: () => qc.invalidateQueries({ queryKey: ["my-tag"] }) });
  if (!data) return <span className="text-[var(--ink-mute)]">…</span>;
  const open = data.requests.find((r) => r.status === "to_send" || r.status === "sent");
  const last = data.requests[0];
  return (
    <div className="flex flex-col gap-1.5">
      <div>{data.tag ? <span className="mono">{data.tag.number}</span> : "No tag yet"}{data.tag && <span className="ml-2"><Badge tone="brand">{data.tag.status}</Badge></span>}</div>
      {open ? <div className="text-xs text-[var(--ink-soft)]">{reqKind[open.kind]}: <span className="font-medium">{reqStatus[open.status]}</span>. We'll let you know when it's ready.</div>
        : <div><Button variant="outline" disabled={ask.isPending} onClick={() => confirm(data.tag ? "Report your tag as lost and request a replacement?" : "Request an access tag?") && ask.mutate()}>{data.tag ? "I lost my tag" : "Request a tag"}</Button></div>}
      {!open && last?.status === "confirmed" && last.newTagNumber && <div className="text-xs text-[var(--ok)]">Your new tag {last.newTagNumber} is active.</div>}
      {!open && last?.status === "rejected" && <div className="text-xs text-[var(--danger)]">Your last request was rejected. Ask the office manager.</div>}
      {ask.isError && <div role="alert" className="text-xs text-[var(--danger)]">{ask.error.message}</div>}
    </div>
  );
}

export default function OfficeInfo({ me }: { me: Me }) {
  const { data, isLoading } = useQuery({ queryKey: ["office"], queryFn: () => api<Office>("/office") });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Office info" subtitle="WiFi, door details, and short videos for the essentials." />
      {isLoading || !data ? <Skeleton className="h-48" /> : (
        <>
          <Card>
            <div className="px-5 pt-4 pb-3 text-base font-semibold">My info</div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 pb-4 text-sm md:grid-cols-2">
              {[
                ["Plan", me.plan],
                ["Address", [data.info.office, data.info.address, data.info.city].filter(Boolean).join(", ") || ""],
                ["Manager contact", data.info.managerContact || ""],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wide text-[var(--ink-mute)]">{k}</dt>
                  <dd className="mt-0.5">{v || <span className="text-xs text-[var(--warn)]">Not set — ask the office manager.</span>}</dd>
                </div>
              ))}
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--ink-mute)]">My tag</dt>
                <dd className="mt-0.5"><TagBlock /></dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-[var(--ink-mute)]">House rules</dt>
                <dd className="mt-0.5">{data.info.rules?.length ? <ul className="list-disc pl-5">{data.info.rules.map((r) => <li key={r}>{r}</li>)}</ul> : <span className="text-xs text-[var(--warn)]">Not set — ask the office manager.</span>}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <div className="flex items-center gap-2 px-5 pt-4 pb-3 text-base font-semibold"><Wifi className="size-4" />WiFi</div>
            <div className="grid grid-cols-1 gap-3 px-5 pb-4 md:grid-cols-2">
              {data.wifi.map((w) => (
                <div key={w.ssid} className="rounded-[var(--r-md)] border border-[var(--line)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">{w.label}</span>
                    <Badge tone="brand">{w.visibility}</Badge>
                  </div>
                  <dl className="grid grid-cols-[80px_1fr_auto] items-center gap-x-2 gap-y-1.5 text-sm">
                    <dt className="text-xs uppercase tracking-wide text-[var(--ink-mute)]">SSID</dt>
                    <dd className="truncate">{w.ssid}</dd>
                    <dd><CopyButton value={w.ssid} /></dd>
                    <dt className="text-xs uppercase tracking-wide text-[var(--ink-mute)]">Password</dt>
                    <dd className="mono truncate">{w.password || <span className="font-sans text-xs text-[var(--warn)]">Not set — ask the office manager.</span>}</dd>
                    <dd><CopyButton value={w.password} /></dd>
                  </dl>
                  <p className="mt-2 text-xs text-[var(--ink-mute)]">{w.note}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="px-5 pt-4 pb-3 text-base font-semibold">Onboarding videos</div>
            <div className="grid grid-cols-1 gap-3 px-5 pb-4 md:grid-cols-2">
              {data.videos.map((v) => (
                <a key={v.title} href={v.url || undefined} target="_blank" rel="noreferrer"
                  className="flex items-start gap-3 rounded-[var(--r-md)] border border-[var(--line)] p-3 transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)]">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-ink)]"><ExternalLink className="size-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="font-medium">{v.title}</span><span className="text-xs text-[var(--ink-mute)]">{v.duration}</span></div>
                    <p className="mt-0.5 text-xs text-[var(--ink-mute)]">{v.description}</p>
                    {!v.url && <p className="mt-1 text-[10px] text-[var(--warn)]">Link not set — ask the office manager.</p>}
                  </div>
                </a>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
