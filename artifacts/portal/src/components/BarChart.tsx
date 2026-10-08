// A small accessible bar chart: the axis always starts at zero, every bar has its value printed, and the whole chart is
// described to screen readers. No chart library needed for this.
export type Bar = { label: string; value: number; sub?: string; highlight?: boolean; short?: string };

export default function BarChart({ bars, unit, title, max, height = 180, color = "var(--brand)" }: { bars: Bar[]; unit: string; title: string; max?: number; height?: number; color?: string }) {
  // A round scale (steps of 1, 2, 5, 10…), always starting at zero, so the gridlines read as whole numbers.
  const peak = Math.max(0, ...bars.map((b) => b.value));
  const step = max ? max / 4 : [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find((s) => Math.ceil(Math.max(peak, 1) / s) <= 5) ?? 1000;
  const top = max ?? Math.max(step, Math.ceil(peak / step) * step);
  const W = 720, padL = 36, padB = 38, padT = 14, plotH = height, n = Math.max(1, bars.length);
  const slot = (W - padL - 8) / n, bw = Math.min(40, slot * 0.68);
  const y = (v: number) => padT + plotH - (Math.min(v, top) / top) * plotH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Math.round(i * step * 100) / 100);
  const label = `${title}. ${bars.map((b) => `${b.label}: ${b.value}${unit}`).join(", ")}.`;
  return (
    <svg viewBox={`0 0 ${W} ${padT + plotH + padB}`} role="img" aria-label={label} className="h-auto w-full">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - 4} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--ink-mute)">{t}{unit}</text>
        </g>
      ))}
      {bars.map((b, i) => {
        const x = padL + i * slot + (slot - bw) / 2;
        return (
          <g key={b.label + i}>
            <rect x={x} y={y(b.value)} width={bw} height={Math.max(0, padT + plotH - y(b.value))} rx={3} fill={color} opacity={b.highlight ? 0.45 : 1}>
              <title>{`${b.label}: ${b.value}${unit}${b.sub ? ` (${b.sub})` : ""}`}</title>
            </rect>
            {bars.length <= 14 && b.value > 0 && <text x={x + bw / 2} y={y(b.value) - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--ink)">{b.value}</text>}
            <text x={x + bw / 2} y={padT + plotH + 14} textAnchor="middle" fontSize={bars.length > 14 ? 9 : 10} fill="var(--ink-soft)">{b.short ?? b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
