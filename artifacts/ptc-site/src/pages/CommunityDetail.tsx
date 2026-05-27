import { SITE, communityById, EVENTS } from '@/lib/tokens';
import { NavBar, Page } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { CommunityBadge } from '@/components/CommunityBadge';
import { ThemeTag } from '@/components/ThemeTag';
import { EventRow } from '@/components/EventRow';

interface CommunityDetailProps {
  communityId: string;
  onNavigate: (page: Page) => void;
}

const PAST_EVENTS: Record<string, Array<{ date: string; title: string }>> = {
  'coimbra-ml': [
    { date: 'May 28, 2026', title: 'PyTorch internals — a walk through the source' },
    { date: 'May 14, 2026', title: 'RAG in production: lessons from 12 months' },
    { date: 'Apr 30, 2026', title: 'Vector databases — when do you actually need one?' },
    { date: 'Apr 16, 2026', title: 'Diffusion models from scratch · 90-min workshop' },
    { date: 'Apr 02, 2026', title: 'Fine-tuning open-weight models on consumer GPUs' },
  ],
};

function defaultPastEvents(communityName: string) {
  return [
    { date: 'May 28, 2026', title: `${communityName} · May edition` },
    { date: 'May 14, 2026', title: `${communityName} · Workshop` },
    { date: 'Apr 30, 2026', title: `${communityName} · April edition` },
    { date: 'Apr 16, 2026', title: `${communityName} · Lightning talks` },
    { date: 'Apr 02, 2026', title: `${communityName} · Networking night` },
  ];
}

export function CommunityDetail({ communityId, onNavigate }: CommunityDetailProps) {
  const comm = communityById(communityId);
  const upcoming = EVENTS.filter(e => e.commId === comm.id);
  const past = PAST_EVENTS[comm.id] || defaultPastEvents(comm.name);

  return (
    <div style={{ background: SITE.paper, minHeight: '100%', fontFamily: '"Space Grotesk", sans-serif' }}>
      <NavBar active="communities" onNavigate={onNavigate} />

      {/* Breadcrumb */}
      <div style={{
        padding: '20px 48px', borderBottom: `1px solid ${SITE.rule}`,
        fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
        color: SITE.mute, letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>
        <span
          onClick={() => onNavigate('communities')}
          style={{ cursor: 'pointer' }}
        >
          ← Communities
        </span>
        <span> · {comm.name}</span>
      </div>

      {/* Community header */}
      <div style={{
        padding: '48px 48px 40px', borderBottom: `1px solid ${SITE.rule}`,
        display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 32, alignItems: 'flex-start',
      }}>
        <CommunityBadge comm={comm} size={96} />
        <div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
            color: SITE.mute, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6,
          }}>
            {comm.city} · since {comm.founded} · {comm.members} members
          </div>
          <h1 style={{
            fontWeight: 700, fontSize: 48, letterSpacing: '-0.025em',
            color: SITE.ink, margin: 0, lineHeight: 1,
          }}>
            {comm.name}
          </h1>
          <div style={{ fontSize: 16, color: SITE.inkSoft, marginTop: 14, lineHeight: 1.5, maxWidth: 620 }}>
            {comm.blurb} Built on a single principle: technical depth, but always accessible to newcomers. Monthly meetups, occasional workshops, an active Discord.
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
            {comm.themes.map(k => <ThemeTag key={k} themeKey={k} />)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          <button style={{
            background: SITE.ink, color: SITE.limestone,
            padding: '12px 18px', fontWeight: 600, fontSize: 13,
            border: 'none', cursor: 'pointer', fontFamily: '"Space Grotesk", sans-serif',
          }}>
            Visit site ↗
          </button>
          <button style={{
            border: `1px solid ${SITE.ink}`, padding: '12px 18px',
            fontWeight: 600, fontSize: 13, color: SITE.ink,
            background: 'transparent', cursor: 'pointer', fontFamily: '"Space Grotesk", sans-serif',
          }}>
            Join Discord ↗
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{
        padding: '24px 48px', borderBottom: `1px solid ${SITE.rule}`,
        display: 'flex', gap: 64, background: SITE.paperWarm,
      }}>
        {[
          { label: 'Events organized', value: comm.orgCount },
          { label: 'Years active',     value: 2026 - comm.founded },
          { label: 'Avg. attendance',  value: '85' },
          { label: 'Next event',       value: upcoming.length ? `${upcoming[0].when.mo} ${upcoming[0].when.day}` : '—' },
        ].map(s => (
          <div key={s.label}>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
              color: SITE.mute, letterSpacing: '0.15em', textTransform: 'uppercase',
            }}>
              {s.label}
            </div>
            <div style={{
              fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 28,
              color: SITE.ink, marginTop: 4, letterSpacing: '-0.01em',
            }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming */}
      <div style={{ padding: '48px 48px 24px' }}>
        <h2 style={{ fontWeight: 700, fontSize: 24, color: SITE.ink, letterSpacing: '-0.01em', margin: 0, marginBottom: 4 }}>
          Upcoming
        </h2>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
          color: SITE.mute, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16,
        }}>
          {upcoming.length} event{upcoming.length !== 1 ? 's' : ''}
        </div>
        {upcoming.length > 0
          ? upcoming.map(e => <EventRow key={e.id} event={e} />)
          : (
            <div style={{ color: SITE.mute, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, padding: '20px 0' }}>
              No upcoming events scheduled
            </div>
          )}
      </div>

      {/* Past events */}
      <div style={{ padding: '24px 48px 64px' }}>
        <h2 style={{ fontWeight: 700, fontSize: 24, color: SITE.ink, letterSpacing: '-0.01em', margin: 0, marginBottom: 4 }}>
          Past events
        </h2>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
          color: SITE.mute, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16,
        }}>
          Most recent · {comm.orgCount} total
        </div>
        <div>
          {past.map((e, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 24,
              alignItems: 'center', padding: '14px 0', borderTop: `1px solid ${SITE.rule}`,
            }}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                color: SITE.mute, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                {e.date}
              </div>
              <div style={{
                fontFamily: '"Space Grotesk", sans-serif', fontWeight: 500, fontSize: 15, color: SITE.ink,
              }}>
                {e.title}
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                color: SITE.mute, letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}>
                View →
              </div>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}
