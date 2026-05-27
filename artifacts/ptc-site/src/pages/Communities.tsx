import { SITE, COMMUNITIES } from '@/lib/tokens';
import { NavBar, Page } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { FilterBar } from '@/components/FilterBar';
import { CommunityCard } from '@/components/CommunityCard';

interface CommunitiesProps {
  onNavigate: (page: Page, communityId?: string) => void;
}

export function Communities({ onNavigate }: CommunitiesProps) {
  return (
    <div style={{ background: SITE.paper, minHeight: '100%', fontFamily: '"Space Grotesk", sans-serif' }}>
      <NavBar active="communities" onNavigate={onNavigate} />

      {/* Page header */}
      <div style={{ padding: '40px 48px 24px' }}>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
          color: SITE.mute, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8,
        }}>
          Directory · 12 communities
        </div>
        <h1 style={{ fontWeight: 700, fontSize: 42, letterSpacing: '-0.02em', color: SITE.ink, margin: 0 }}>
          The communities
        </h1>
      </div>

      <FilterBar activeCity="All cities" activeThemes={[]} />

      <div style={{ padding: '32px 48px 64px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {COMMUNITIES.map(c => (
            <CommunityCard
              key={c.id}
              comm={c}
              onClick={() => onNavigate('community-detail', c.id)}
            />
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}
