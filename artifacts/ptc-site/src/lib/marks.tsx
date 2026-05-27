// PTC pixel-art mark — speech bubble with "PTC" carved in bold pixel letters.
// Ported from conversation.jsx + pixel-art.jsx in the design files.

// Bold PTC pixel letters (9 rows tall, stroke weight 2)
const BOLD_P = [
  '111110',
  '110011',
  '110011',
  '110011',
  '111110',
  '110000',
  '110000',
  '110000',
  '110000',
];

const BOLD_T = [
  '1111111',
  '1111111',
  '0011100',
  '0011100',
  '0011100',
  '0011100',
  '0011100',
  '0011100',
  '0011100',
];

const BOLD_C = [
  '011111',
  '110011',
  '110000',
  '110000',
  '110000',
  '110000',
  '110000',
  '110011',
  '011111',
];

function lettersToCells(letters: string[][], gap = 1): string[] {
  const rows = letters[0].length;
  const cells: string[] = [];
  for (let r = 0; r < rows; r++) {
    let row = '';
    letters.forEach((L, i) => {
      if (i > 0) row += '.'.repeat(gap);
      row += L[r];
    });
    cells.push(row);
  }
  return cells;
}

interface Tail { side: string; pos: number; length?: number }
function multiTailBubble({ bodyW, bodyH, tails = [] as Tail[], cornerStyle = 'round' }: { bodyW: number; bodyH: number; tails?: Tail[]; cornerStyle?: string }) {
  let padT = 0, padR = 0, padB = 0, padL = 0;
  for (const t of tails) {
    const L = t.length ?? 3;
    if (t.side === 'top')    padT = Math.max(padT, L);
    else if (t.side === 'right')  padR = Math.max(padR, L);
    else if (t.side === 'bottom') padB = Math.max(padB, L);
    else if (t.side === 'left')   padL = Math.max(padL, L);
  }
  const W = bodyW + padL + padR;
  const H = bodyH + padT + padB;
  const bx = padL, by = padT;

  const grid: string[][] = [];
  for (let r = 0; r < H; r++) grid.push(new Array(W).fill('.'));

  const cut = cornerStyle === 'pillow' ? 2 : cornerStyle === 'block' ? 0 : 1;
  for (let r = 0; r < bodyH; r++) {
    for (let c = 0; c < bodyW; c++) {
      const isCornerCut = cut > 0 && (
        (r < cut && c < cut && r + c < cut) ||
        (r < cut && c >= bodyW - cut && r + (bodyW - 1 - c) < cut) ||
        (r >= bodyH - cut && c < cut && (bodyH - 1 - r) + c < cut) ||
        (r >= bodyH - cut && c >= bodyW - cut && (bodyH - 1 - r) + (bodyW - 1 - c) < cut)
      );
      if (isCornerCut) { grid[by + r][bx + c] = '.'; continue; }
      const onBorder = r === 0 || r === bodyH - 1 || c === 0 || c === bodyW - 1;
      grid[by + r][bx + c] = onBorder ? '1' : '0';
    }
  }

  for (const tl of tails) {
    const L = tl.length ?? 3;
    if (tl.side === 'top') {
      const x = bx + Math.max(0, Math.min(bodyW - 1, Math.round(tl.pos * (bodyW - 1))));
      for (let i = 0; i < L; i++) {
        const width = L - i;
        for (let j = 0; j < width; j++) {
          const rr = by - 1 - i; const cc = x + j;
          if (rr >= 0 && cc >= 0 && cc < W) grid[rr][cc] = '1';
        }
      }
    } else if (tl.side === 'bottom') {
      const x = bx + Math.max(0, Math.min(bodyW - 1, Math.round(tl.pos * (bodyW - 1))));
      for (let i = 0; i < L; i++) {
        const width = L - i;
        for (let j = 0; j < width; j++) {
          const rr = by + bodyH + i; const cc = x - j;
          if (rr < H && cc >= 0 && cc < W) grid[rr][cc] = '1';
        }
      }
    } else if (tl.side === 'left') {
      const y = by + Math.max(0, Math.min(bodyH - 1, Math.round(tl.pos * (bodyH - 1))));
      for (let i = 0; i < L; i++) {
        const height = L - i;
        for (let j = 0; j < height; j++) {
          const cc = bx - 1 - i; const rr = y + j;
          if (cc >= 0 && rr < H && rr >= 0) grid[rr][cc] = '1';
        }
      }
    } else if (tl.side === 'right') {
      const y = by + Math.max(0, Math.min(bodyH - 1, Math.round(tl.pos * (bodyH - 1))));
      for (let i = 0; i < L; i++) {
        const height = L - i;
        for (let j = 0; j < height; j++) {
          const cc = bx + bodyW + i; const rr = y - j;
          if (cc < W && rr >= 0 && rr < H) grid[rr][cc] = '1';
        }
      }
    }
  }

  return { grid: grid.map(r => r.join('')), bx, by, bodyW, bodyH };
}

function placeContentCentered(
  { grid, bx, by, bodyW, bodyH }: ReturnType<typeof multiTailBubble>,
  content: string[],
) {
  const ch = content.length;
  const cw = Math.max(...content.map(r => r.length));
  const interiorW = bodyW - 2;
  const interiorH = bodyH - 2;
  const ox = bx + 1 + Math.floor((interiorW - cw) / 2);
  const oy = by + 1 + Math.floor((interiorH - ch) / 2);
  const out = grid.map(r => r.split(''));
  for (let r = 0; r < ch; r++) {
    for (let c = 0; c < content[r].length; c++) {
      const v = content[r][c];
      if (v === '1' || v === '2') {
        if (oy + r >= 0 && oy + r < out.length && ox + c >= 0 && ox + c < out[0].length) {
          out[oy + r][ox + c] = v;
        }
      }
    }
  }
  return out.map(r => r.join(''));
}

function fourTails(length = 3) {
  return [
    { side: 'top',    pos: 0.72, length },
    { side: 'right',  pos: 0.35, length },
    { side: 'bottom', pos: 0.28, length },
    { side: 'left',   pos: 0.70, length },
  ];
}

export function ptcBubbleCells({ cornerStyle = 'pillow', tails = fourTails(3), padX = 4, padY = 3 } = {}): string[] {
  const content = lettersToCells([BOLD_P, BOLD_T, BOLD_C], 2);
  const cw = content[0].length;
  const ch = content.length;
  const bodyW = cw + padX * 2;
  const bodyH = ch + padY * 2;
  const bubble = multiTailBubble({ bodyW, bodyH, tails, cornerStyle });
  return placeContentCentered(bubble, content);
}
