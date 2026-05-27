import { Event, communityById, SITE } from '@/lib/tokens';
import { CommunityBadge } from './CommunityBadge';
import { ThemeTag } from './ThemeTag';

interface EventRowProps {
  event: Event;
}

export function EventRow({ event }: EventRowProps) {
  const comm = communityById(event.commId);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '80px 1fr auto',
      gap: 24, alignItems: 'center',
      padding: '20px 0',
      borderTop: `1px solid ${SITE.rule}`,
    }}>
      {/* Date block */}
      <div style={{ borderRight: `1px solid ${SITE.rule}`, paddingRight: 16, textAlign: 'right' }}>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
          letterSpacing: '0.15em', color: SITE.mute, textTransform: 'uppercase',
        }}>
          {event.when.wd}
        </div>
        <div style={{
          fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 28,
          lineHeight: 1, color: SITE.ink, marginTop: 4,
        }}>
          {String(event.when.day).padStart(2, '0')}
        </div>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
          color: SITE.mute, marginTop: 4, letterSpacing: '0.1em',
        }}>
          {event.when.mo}
        </div>
      </div>

      {/* Content */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <CommunityBadge comm={comm} size={20} />
          <span style={{
            fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600,
            fontSize: 13, color: SITE.ink,
          }}>
            {comm.name}
          </span>
          <span style={{ color: SITE.rule }}>·</span>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
            color: SITE.mute, letterSpacing: '0.05em',
          }}>
            {event.when.time} · {event.city} · {event.venue}
          </span>
        </div>
        <div style={{
          fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 20,
          color: SITE.ink, letterSpacing: '-0.01em', lineHeight: 1.2,
        }}>
          {event.title}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {comm.themes.slice(0, 2).map(k => <ThemeTag key={k} themeKey={k} small />)}
        </div>
      </div>

      {/* Action */}
      <div>
        <div style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontWeight: 600, fontSize: 13,
          background: SITE.ink, color: SITE.limestone,
          padding: '10px 16px',
          display: 'inline-block',
          cursor: 'pointer',
        }}>
          Register ↗
        </div>
      </div>
    </div>
  );
}
