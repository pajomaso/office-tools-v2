import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import clsx from "clsx";
import { api, type Metrics, type OccPoint } from "@/lib/api";
import { Card, PageHeader, Skeleton, fieldCompact } from "@/components/ui";
import BarChart from "@/components/BarChart";
import { fmtDay } from "@/lib/time";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

function windowText(w: Metrics["window"]) {
  const d = [...w.weekdays].map((x) => DAYS[x]);
  const consecutive = w.weekdays.every((x, i) => i === 0 || x === w.weekdays[i - 1]! + 1);
  return `${consecutive && d.length > 2 ? `${d[0]}–${d[d.length - 1]}` : d.join(", ")} ${hourLabel(w.startHour)}–${hourLabel(w.endHour)}`;
}

export default function MetricsPage() {
  const [gran, setGran] = useState<"week" | "month">("week");
  const [count, setCount] = useState(12);
  const [room, setRoom] = useState("all");
  const m = useQuery({ queryKey: ["metrics", gran, count], queryFn: () => api<Metrics>(`/admin/metrics?granularity=${gran}&periods=${count}`) });
  const d = m.data;
  const series: OccPoint[] = d ? (room === "all" ? d.overall : d.byRoom[room] ?? []) : [];
  const peak = d ? (room === "all" ? d.peak.overall : d.peak.byRoom[room] ?? []) : [];
  const roomName = d?.rooms.find((r) => r.id === room)?.name ?? "All rooms";
  const topHours = peak.map((v, h) => ({ h, v })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 3);
  const avg = series.length ? Math.round((series.reduce((s, p) => s + p.pct, 0) / series.length) * 10) / 10 : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Metrics" subtitle={d ? `Occupancy is the share of the working window (${windowText(d.window)}) that rooms are booked. Change the window in Settings.` : "Room occupancy and peak hours."} />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-[var(--surface-2)] p-1" role="tablist" aria-label="Group by">
          {([["week", "By week"], ["month", "By month"]] as const).map(([g, l]) => (
            <button key={g} type="button" role="tab" aria-selected={gran === g} onClick={() => { setGran(g); setCount(g === "week" ? 12 : 12); }} className={clsx("rounded-md px-3 py-1 text-sm font-medium cursor-pointer", gran === g ? "bg-[var(--surface)] shadow-[var(--shadow-sm)]" : "text-[var(--ink-soft)]")}>{l}</button>
          ))}
        </div>
        <label className="sr-only" htmlFor="m-room">Room</label>
        <select id="m-room" className={`${fieldCompact} w-44`} value={room} onChange={(e) => setRoom(e.target.value)}><option value="all">All rooms</option>{d?.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <label className="sr-only" htmlFor="m-count">How many periods</label>
        <select id="m-count" className={`${fieldCompact} w-40`} value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {(gran === "week" ? [8, 12, 26] : [6, 12, 24]).map((n) => <option key={n} value={n}>Last {n} {gran}s</option>)}
        </select>
      </div>

      {m.isLoading || !d ? <Skeleton className="h-64" /> : (
        <>
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">Occupancy · {roomName}</h2>
              <span className="text-xs text-[var(--ink-mute)]">Average over the period: <b className="text-[var(--ink)]">{avg}%</b></span>
            </div>
            <BarChart title={`Occupancy ${roomName} by ${gran}`} unit="%" bars={series.map((p) => ({ label: p.label, short: gran === "week" ? fmtDay(p.key, { day: "numeric", month: "short" }) : p.label, value: p.pct, sub: `${p.booked} of ${p.available} hours`, highlight: p.key === d.currentKey }))} />
            <p className="mt-2 text-xs text-[var(--ink-mute)]">{gran === "week" ? "Weeks are labelled by the Monday they start on. " : ""}The lighter bar is the current {gran}: it counts bookings still to come as well as the ones already past.</p>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-[var(--brand)]">Show the numbers</summary>
              <table className="mt-2 w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--ink-mute)]"><th className="py-1 font-medium">{gran === "week" ? "Week" : "Month"}</th><th className="py-1 font-medium">Booked</th><th className="py-1 font-medium">Available</th><th className="py-1 text-right font-medium">Occupancy</th></tr></thead>
                <tbody>{series.map((p) => <tr key={p.key} className="border-t border-[var(--line)]"><td className="py-1">{p.label}</td><td className="tnum py-1">{p.booked} h</td><td className="tnum py-1">{p.available} h</td><td className="tnum py-1 text-right font-medium">{p.pct}%</td></tr>)}</tbody>
              </table>
            </details>
          </Card>

          {room === "all" && d.rooms.length > 1 && (
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold">By room · latest complete {gran}</h2>
              <ul className="flex flex-col gap-2">
                {d.rooms.map((r) => { const pts = d.byRoom[r.id] ?? []; const p = pts[Math.max(0, pts.length - 2)]; return (
                  <li key={r.id} className="grid grid-cols-[110px_1fr_52px] items-center gap-3 text-sm">
                    <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: r.color }} />{r.name}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, p?.pct ?? 0)}%`, background: r.color }} /></span>
                    <span className="tnum text-right font-medium">{p?.pct ?? 0}%</span>
                  </li>); })}
              </ul>
              <p className="mt-2 text-xs text-[var(--ink-mute)]">Compare the rooms in the chart above by choosing one in the list.</p>
            </Card>
          )}

          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">Peak hours · {roomName}</h2>
              <span className="text-xs text-[var(--ink-mute)]">Hours booked at each time of day over the {count} {gran}s shown, all 24 hours counted</span>
            </div>
            {topHours.length ? <p className="mb-2 text-sm text-[var(--ink-soft)]">Busiest: {topHours.map((t) => `${hourLabel(t.h)}–${hourLabel((t.h + 1) % 24)} (${Math.round(t.v * 10) / 10} h)`).join(" · ")}</p> : <p className="mb-2 text-sm text-[var(--ink-mute)]">No bookings in this period.</p>}
            <BarChart title={`Booked hours per time of day, ${roomName}`} unit=" h" color="var(--brand-ink)" height={150} bars={peak.map((v, h) => ({ label: String(h), value: Math.round(v * 10) / 10, sub: `${hourLabel(h)}–${hourLabel((h + 1) % 24)}` }))} />
            <p className="mt-1 text-xs text-[var(--ink-mute)]">Bars are clock hours in Braga time (0 = midnight to 1 a.m.).</p>
          </Card>
          <p className="text-xs text-[var(--ink-mute)]">Looking for the bookings behind these numbers? <Link href="/app/bookings" className="text-[var(--brand)] hover:underline">Open the booking history</Link>.</p>
        </>
      )}
    </div>
  );
}
