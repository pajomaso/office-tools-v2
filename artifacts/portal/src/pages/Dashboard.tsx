import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { KeyRound, UserPlus } from "lucide-react";
import { api, type Booking, type InboxCount, type Item, type Me, type Room } from "@/lib/api";
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { itemKind } from "@/lib/labels";
import { addDays, fmtDay, hm, lisbonToUtc, todayStr, ymd } from "@/lib/time";

// The admin's inbox: what needs an admin right now, in one place.
export default function Dashboard({ me }: { me: Me }) {
  const qc = useQueryClient();
  const today = todayStr();
  const from = lisbonToUtc(today, "00:00").toISOString(), to = lisbonToUtc(addDays(today, 1), "00:00").toISOString();
  const count = useQuery({ queryKey: ["inbox-count"], queryFn: () => api<InboxCount>("/inbox/count"), refetchInterval: 60_000 });
  const items = useQuery({ queryKey: ["items"], queryFn: () => api<Item[]>("/items") });
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: () => api<Room[]>("/rooms") });
  const bookings = useQuery({ queryKey: ["bookings", "today", from], queryFn: () => api<Booking[]>(`/bookings?from=${from}&to=${to}`) });
  const claim = useMutation({ mutationFn: (id: string) => api(`/admin/items/${id}`, { method: "PATCH", json: { claim: true } }), onSuccess: () => ["items", "inbox-count"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })) });
  const unclaimed = (items.data ?? []).filter((i) => i.status === "open" && !i.claimedBy);
  const room = (id: string) => rooms.data?.find((r) => r.id === id);
  const c = count.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Hello, ${me.name.split(" ")[0]}`} subtitle="Office 42 · Braga" actions={<>
        <Link href="/app/users" className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--brand)] px-4 text-sm font-medium text-white hover:bg-[var(--brand)]/90"><UserPlus className="size-4" />New user / give a tag</Link>
        <Link href="/app/tags" className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-2)]"><KeyRound className="size-4" />Change a tag</Link>
      </>} />

      <section aria-label="Unclaimed issues and requests">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Unclaimed ({unclaimed.length})</h2><Link href="/app/issues" className="text-xs font-medium text-[var(--brand)] hover:underline">Open the board →</Link></div>
        {items.isLoading ? <Skeleton className="h-20" /> : unclaimed.length ? (
          <ul className="flex flex-col gap-2">{unclaimed.slice(0, 6).map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5">
              <div className="min-w-0"><div className="flex items-center gap-2"><Badge>{itemKind[i.kind]}</Badge>{i.visibility === "private" && <Badge>Private</Badge>}<span className="truncate text-sm font-semibold">{i.title}</span></div><div className="text-[11px] text-[var(--ink-mute)]">{i.author} · {fmtDay(ymd(i.createdAt), { day: "numeric", month: "short" })}</div></div>
              <Button variant="outline" disabled={claim.isPending} onClick={() => claim.mutate(i.id)}>Claim</Button>
            </li>
          ))}</ul>
        ) : <EmptyState title="All clear" body="Everything has been picked up." />}
        {unclaimed.length > 6 && <p className="mt-2 text-xs text-[var(--ink-mute)]">…and {unclaimed.length - 6} more on the board.</p>}
        {claim.isError && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{claim.error.message}</p>}
      </section>

      <section aria-label="Tags">
        <h2 className="mb-2 text-sm font-semibold">Tags and Ricardo</h2>
        {count.isLoading ? <Skeleton className="h-16" /> : (
          <ul className="flex flex-col gap-2">
            <li><Link href="/app/tags" className="flex items-center justify-between gap-3 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--line-strong)]">
              <span className="text-sm">{c?.openTagLines ? <>The pending batch has <b>{c.openTagLines}</b> change{c.openTagLines === 1 ? "" : "s"} waiting to be sent</> : "No tag changes waiting to be sent"}</span>{!!c?.openTagLines && <Badge tone="brand">To send</Badge>}
            </Link></li>
            {!!c?.supplierUpdates && <li><Link href="/app/tags" className="flex items-center justify-between gap-3 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--line-strong)]"><span className="text-sm">Ricardo has <b>{c.supplierUpdates}</b> update{c.supplierUpdates === 1 ? "" : "s"} you haven't seen</span><Badge tone="brand">New</Badge></Link></li>}
          </ul>
        )}
      </section>

      <section aria-label="Today's room bookings">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Today's room bookings</h2><Link href="/app/rooms" className="text-xs font-medium text-[var(--brand)] hover:underline">Open calendar →</Link></div>
        {bookings.isLoading ? <Skeleton className="h-16" /> : bookings.data?.length ? (
          <Card><ul className="divide-y divide-[var(--line)]">{bookings.data.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="flex min-w-0 items-center gap-2.5"><span className="size-2 shrink-0 rounded-full" style={{ background: room(b.roomId)?.color }} /><span className="truncate"><span className="font-medium">{room(b.roomId)?.name}</span> · {b.title}{b.bookedFor ? ` (for ${b.bookedFor})` : ""}<span className="text-[var(--ink-mute)]"> · {b.owner}</span></span></span>
              <span className="tnum shrink-0 text-xs text-[var(--ink-soft)]">{hm(b.startsAt)} – {hm(b.endsAt)}</span>
            </li>
          ))}</ul></Card>
        ) : <p className="text-sm text-[var(--ink-mute)]">No rooms are booked today.</p>}
      </section>
    </div>
  );
}
