import { Community } from '@/lib/tokens';

interface CommunityBadgeProps {
  comm: Community;
  size?: number;
}

export function CommunityBadge({ comm, size = 26 }: CommunityBadgeProps) {
  const initials = comm.name.split(/\s+/).slice(0, 2).map(w => w[0]).join('');
  return (
    <div title={comm.name} style={{
      width: size, height: size,
      background: comm.accent, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"JetBrains Mono", monospace', fontWeight: 500,
      fontSize: size * 0.42, letterSpacing: '0.02em',
      borderRadius: 4,
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}
