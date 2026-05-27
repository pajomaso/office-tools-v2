import { THEMES, ThemeKey } from '@/lib/tokens';

interface ThemeTagProps {
  themeKey: ThemeKey;
  small?: boolean;
}

export function ThemeTag({ themeKey, small = false }: ThemeTagProps) {
  const th = THEMES.find(t => t.key === themeKey);
  if (!th) return null;
  return (
    <span style={{
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: small ? 9 : 10,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: th.color,
      border: `1px solid ${th.color}55`,
      background: `${th.color}10`,
      padding: small ? '2px 6px' : '3px 8px',
      borderRadius: 2,
    }}>
      {th.label}
    </span>
  );
}
