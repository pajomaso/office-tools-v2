import { SITE, THEMES, ThemeKey } from '@/lib/tokens';

interface FilterBarProps {
  activeCity?: string;
  activeThemes?: ThemeKey[];
  view?: 'list' | 'calendar' | 'map';
  onCityChange?: (city: string) => void;
  onThemeToggle?: (key: ThemeKey) => void;
  onViewChange?: (view: 'list' | 'calendar' | 'map') => void;
}

export function FilterBar({
  activeCity = 'All cities',
  activeThemes = [],
  view,
  onCityChange,
  onThemeToggle,
  onViewChange,
}: FilterBarProps) {
  return (
    <div style={{
      padding: '20px 48px', borderBottom: `1px solid ${SITE.rule}`, background: SITE.paper,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        {/* City dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            color: SITE.mute, letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>City</span>
          <div style={{
            fontFamily: '"Space Grotesk", sans-serif', fontSize: 13, fontWeight: 600,
            border: `1px solid ${SITE.ink}`, padding: '6px 12px',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#fff', cursor: 'pointer',
          }}>
            {activeCity} <span style={{ opacity: 0.5 }}>▾</span>
          </div>
        </div>

        {/* Theme chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            color: SITE.mute, letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>Themes</span>
          {THEMES.map(t => {
            const on = activeThemes.includes(t.key as ThemeKey);
            return (
              <span
                key={t.key}
                onClick={() => onThemeToggle?.(t.key as ThemeKey)}
                style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  padding: '4px 10px',
                  color: on ? '#fff' : t.color,
                  background: on ? t.color : 'transparent',
                  border: `1px solid ${t.color}`,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </span>
            );
          })}
        </div>

        {/* View toggle */}
        {view !== undefined && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
              color: SITE.mute, letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>View</span>
            <div style={{ display: 'flex', border: `1px solid ${SITE.ink}` }}>
              {(['list', 'calendar', 'map'] as const).map((v, i) => (
                <div
                  key={v}
                  onClick={() => onViewChange?.(v)}
                  style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    padding: '6px 12px',
                    background: v === view ? SITE.ink : '#fff',
                    color: v === view ? SITE.limestone : SITE.ink,
                    cursor: 'pointer',
                    borderRight: i < 2 ? `1px solid ${SITE.ink}` : 'none',
                  }}
                >
                  {v}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
