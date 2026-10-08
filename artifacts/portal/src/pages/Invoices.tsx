import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { api, type Invoice } from "@/lib/api";
import { Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { fmtDay } from "@/lib/time";

export const euro = (c: number | null) => (c == null ? "" : (c / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" }));
export const monthLabel = (p: string) => fmtDay(`${p}-01`, { month: "long", year: "numeric" });

export default function Invoices() {
  const { data, isLoading } = useQuery({ queryKey: ["invoices"], queryFn: () => api<Invoice[]>("/invoices") });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Invoices" subtitle="Your invoices, all in one place." />
      {isLoading ? <Skeleton className="h-32" /> : data?.length ? (
        <Card>
          <ul className="divide-y divide-[var(--line)]">
            {data.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-ink)]"><FileText className="size-4" /></span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{monthLabel(i.period)}{i.number && <span className="ml-2 font-normal text-[var(--ink-mute)]">{i.number}</span>}</div>
                    <div className="text-xs text-[var(--ink-mute)]">{euro(i.amountCents)}</div>
                  </div>
                </div>
                <a href={`/api/portal/invoices/${i.id}/file`} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line-strong)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-2)]">
                  <Download className="size-3.5" />Download
                </a>
              </li>
            ))}
          </ul>
        </Card>
      ) : <EmptyState title="No invoices yet" body="When an invoice is issued for your account, it will show up here." />}
    </div>
  );
}
