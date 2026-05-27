import { SITE, EVENTS } from '@/lib/tokens';
import { NavBar, Page } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { FilterBar } from '@/components/FilterBar';
import { EventRow } from '@/components/EventRow';

interface EventsProps {
  onNavigate: (page: Page) => void;
}

const EVENT_GROUPS = [
  { label: 'Week of Jun 8',  range: 'Mon 08 — Sun 14', events: EVENTS.slice(0, 4) },
  { label: 'Week of Jun 15', range: 'Mon 15 — Sun 21', events: EVENTS.slice(4, 8) },
  { label: 'Week of Jun 22', range: 'Mon 22 — Sun 28', events: EVENTS.slice(8, 12) },
];

export function Events({ onNavigate }: EventsProps) {
  return (
    <div style={{ background: SITE.paper, minHeight: '100%', fontFamily: '"Space Grotesk", sans-serif' }}>
      <NavBar active="events" onNavigate={onNavigate} />

      {/* Page header */}
      <div style={{ padding: '40px 48px 24px' }}>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
          color: SITE.mute, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8,
        }}>
          Directory · 12 events
        </div>
        <h1 style={{ fontWeight: 700, fontSize: 42, letterSpacing: '-0.02em', color: SITE.ink, margin: 0 }}>
          What's happening
        </h1>
      </div>

      <FilterBar activeCity="All cities" activeThemes={['web']} view="list" />

      <div style={{ padding: '0 48px 64px' }}>
        {EVENT_GROUPS.map(g => (
          <div key={g.label} style={{ marginTop: 40 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 4 }}>
              <h2 style={{ fontWeight: 700, fontSize: 22, color: SITE.ink, letterSpacing: '-0.01em', margin: 0 }}>
                {g.label}
              </h2>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                color: SITE.mute, letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>
                {g.range} · {g.events.length} events
              </span>
            </div>
            <div>
              {g.events.map(e => <EventRow key={e.id} event={e} />)}
            </div>
          </div>
        ))}
      </div>

      <Footer />
    </div>
  );
}
