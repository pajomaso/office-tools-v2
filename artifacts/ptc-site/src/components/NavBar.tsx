import { SITE, SITE_PALETTE } from '@/lib/tokens';
import { CleanCells } from '@/lib/stones';
import { ptcBubbleCells } from '@/lib/marks';

const MARK_CELLS = ptcBubbleCells();

export type Page = 'home' | 'events' | 'communities' | 'community-detail';

interface NavBarProps {
  active: Page;
  onNavigate: (page: Page) => void;
}

const NAV_ITEMS = [
  { id: 'events' as Page,      label: 'Events' },
  { id: 'communities' as Page, label: 'Communities' },
  { id: 'submit' as const,     label: 'Submit yours' },
  { id: 'about' as const,      label: 'About' },
];

export function NavBar({ active, onNavigate }: NavBarProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 48px', borderBottom: `1px solid ${SITE.rule}`,
      background: SITE.paper,
    }}>
      <button
        onClick={() => onNavigate('home')}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <CleanCells cells={MARK_CELLS} size={1.8} palette={SITE_PALETTE} shape="square" />
        <div>
          <div style={{
            fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700,
            fontSize: 14, color: SITE.ink, lineHeight: 1, letterSpacing: '-0.01em',
          }}>
            Portuguese Tech Communities
          </div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
            color: SITE.mute, letterSpacing: '0.15em', marginTop: 3, textTransform: 'uppercase',
          }}>
            ptc.pt
          </div>
        </div>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        {NAV_ITEMS.map(item => {
          const isActive = active === item.id;
          const canNav = item.id === 'events' || item.id === 'communities';
          return (
            <div
              key={item.id}
              onClick={() => canNav && onNavigate(item.id as Page)}
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: 14, fontWeight: isActive ? 600 : 500,
                color: isActive ? SITE.ink : SITE.mute,
                borderBottom: isActive ? `2px solid ${SITE.ink}` : '2px solid transparent',
                paddingBottom: 4,
                cursor: canNav ? 'pointer' : 'default',
              }}
            >
              {item.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
