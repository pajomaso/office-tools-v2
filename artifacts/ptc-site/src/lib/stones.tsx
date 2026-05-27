import React from 'react';

// Seeded RNG — deterministic jitter
export function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Palette {
  dark: string;
  light: string;
  accent: string;
}

// ─── CleanCells — render a cells grid as clean SVG rectangles ───────────────
interface CleanCellsProps {
  cells: string[];
  size?: number;
  palette: Palette;
  shape?: 'square' | 'soft' | 'round';
  padding?: number;
  style?: React.CSSProperties;
}

export function CleanCells({ cells, size = 24, palette, shape = 'square', padding = 0, style }: CleanCellsProps) {
  const rows = cells.length;
  const cols = Math.max(...cells.map(r => r.length));
  const W = cols * size + padding * 2;
  const H = rows * size + padding * 2;
  const radius = shape === 'soft' ? size * 0.18 : 0;
  const items: React.ReactNode[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cells[r].length; c++) {
      const ch = cells[r][c];
      let fill: string | null = null;
      if (ch === '1') fill = palette.dark;
      else if (ch === '0') fill = palette.light;
      else if (ch === '2') fill = palette.accent;
      if (!fill) continue;
      const x = padding + c * size;
      const y = padding + r * size;
      if (shape === 'round') {
        items.push(<circle key={`${r}-${c}`} cx={x + size / 2} cy={y + size / 2} r={size / 2} fill={fill} />);
      } else {
        items.push(
          <rect key={`${r}-${c}`} x={x} y={y} width={size} height={size}
            rx={radius || undefined} ry={radius || undefined} fill={fill} />
        );
      }
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block', ...style }}>
      {items}
    </svg>
  );
}

// ─── Stone — one jittered stone ──────────────────────────────────────────────
type StoneRole = 'dark' | 'light' | 'accent' | 'empty';

interface StoneProps {
  x: number; y: number; size: number; role: StoneRole;
  seed?: number; shape?: string; jitter?: number; palette: Palette;
}

function Stone({ x, y, size, role, seed = 0, shape = 'square', jitter = 0.18, palette }: StoneProps) {
  if (role === 'empty') return null;
  const rng = mulberry32(seed * 9301 + x * 131 + y * 7);
  const rot = (rng() - 0.5) * 18 * jitter * 5;
  const dx = (rng() - 0.5) * size * jitter;
  const dy = (rng() - 0.5) * size * jitter;
  const s = size * (1 - jitter * 0.25) + rng() * size * jitter * 0.5;
  let fill = palette.light;
  if (role === 'dark') fill = palette.dark;
  if (role === 'accent') fill = palette.accent;
  const cx = x + size / 2 + dx;
  const cy = y + size / 2 + dy;

  if (shape === 'round') {
    return <circle cx={cx} cy={cy} r={s / 2} fill={fill} />;
  }
  const half = s / 2;
  const r = shape === 'soft' ? s * 0.22 : s * 0.06;
  return (
    <g transform={`rotate(${rot} ${cx} ${cy})`}>
      <rect x={cx - half} y={cy - half} width={s} height={s} rx={r} ry={r} fill={fill} />
    </g>
  );
}

// ─── PaintedStones — continuous paint function drives stone grid ──────────────
export type PaintFn = (x: number, y: number, W: number, H: number) => StoneRole | 'empty';

interface PaintedStonesProps {
  width: number; height: number; cellSize?: number;
  paint: PaintFn; palette: Palette;
  shape?: string; jitter?: number; seed?: number;
}

export function PaintedStones({ width, height, cellSize = 12, paint, palette, shape = 'soft', jitter = 0.18, seed = 1 }: PaintedStonesProps) {
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const items: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellSize;
      const y = r * cellSize;
      const role = paint(x + cellSize / 2, y + cellSize / 2, width, height) as StoneRole;
      if (!role || role === 'empty') continue;
      items.push(
        <Stone key={`${r}-${c}`} x={x} y={y} size={cellSize} role={role}
          seed={seed + r * 31 + c} shape={shape} jitter={jitter} palette={palette} />
      );
    }
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} style={{ overflow: 'visible' }}>
      {items}
    </svg>
  );
}

// ─── Paint functions ──────────────────────────────────────────────────────────
export function makeWavePaint({ bands = 6, period = 0.7, amplitude = 0.12 } = {}): PaintFn {
  return (x, y, W, H) => {
    const offset = Math.sin((x / W) * Math.PI * 2 * period * 2) * H * amplitude;
    const band = ((y + offset) / H) * bands;
    return Math.floor(band) % 2 === 0 ? 'dark' : 'light';
  };
}

export function makeFanPaint({ centerY = 1.0, slices = 14 } = {}): PaintFn {
  return (x, y, W, H) => {
    const cx = W / 2;
    const cy = H * centerY;
    const dx = x - cx, dy = y - cy;
    if (dy > 0) return 'light';
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxR = Math.min(W, H * Math.abs(centerY));
    if (dist > maxR * 0.95) return 'light';
    if (dist < 8) return 'dark';
    const angle = Math.atan2(-dy, dx);
    const slice = (angle / Math.PI) * slices;
    return Math.floor(slice) % 2 === 0 ? 'dark' : 'light';
  };
}

// ─── StoneStripe — horizontal 1–2 row stone strip ────────────────────────────
interface StoneStripeProps {
  width?: number; rows?: number; cellSize?: number;
  color?: string; light?: string; accentColor?: string;
  accentEvery?: number; seed?: number;
}

export function StoneStripe({
  width = 1200, rows = 1, cellSize = 8,
  color = '#1a1a1a', light = '#ece9df',
  accentColor, accentEvery = 0, seed = 1,
}: StoneStripeProps) {
  const cols = Math.floor(width / cellSize);
  const cells: string[] = [];
  for (let r = 0; r < rows; r++) {
    let row = '';
    for (let c = 0; c < cols; c++) {
      const v = (c + r * 2) % 3;
      let ch = v === 0 ? '1' : '0';
      if (accentEvery > 0 && c > 0 && c % accentEvery === 0 && r === 0) ch = '2';
      row += ch;
    }
    cells.push(row);
  }
  const palette: Palette = { dark: color, light, accent: accentColor || color };
  return <CleanCells cells={cells} size={cellSize} palette={palette} shape="square" />;
}

// ─── StoneStamp — 3 stones accent ────────────────────────────────────────────
interface StoneStampProps {
  accent?: string;
  size?: number;
}

export function StoneStamp({ accent = '#1F8A5B', size = 10 }: StoneStampProps) {
  const palette: Palette = { dark: '#1a1a1a', light: '#efebe0', accent };
  return <CleanCells cells={['121']} size={size} palette={palette} shape="square" />;
}
