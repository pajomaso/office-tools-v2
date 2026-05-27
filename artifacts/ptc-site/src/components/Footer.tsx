import { SITE, SITE_PALETTE } from '@/lib/tokens';
import { CleanCells, StoneStripe } from '@/lib/stones';
import { ptcBubbleCells } from '@/lib/marks';

const MARK_CELLS = ptcBubbleCells();

export function Footer() {
  return (
    <div style={{ background: SITE.paperWarm }}>
      <div style={{ background: SITE.ink }}>
        <StoneStripe width={1280} rows={1} cellSize={8} color={SITE.limestone} light={SITE.ink} accentColor={SITE.green} accentEvery={11} seed={99} />
      </div>
      <div style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CleanCells cells={MARK_CELLS} size={1.4} palette={SITE_PALETTE} shape="square" />
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            color: SITE.mute, letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>
            Portuguese Tech Communities · 2026
          </div>
        </div>
        <div style={{
          display: 'flex', gap: 24,
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
          color: SITE.mute, letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          <span style={{ cursor: 'pointer' }}>github</span>
          <span style={{ cursor: 'pointer' }}>twitter</span>
          <span style={{ cursor: 'pointer' }}>discord</span>
          <span style={{ cursor: 'pointer' }}>contact</span>
        </div>
      </div>
    </div>
  );
}
