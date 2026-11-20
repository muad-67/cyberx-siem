/**
 * theme.js — CyberX Design System
 * Shared color + style constants used by every component.
 * Light, soft-surface look: grey canvas, white cards, one violet accent.
 */

export const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
export const MONO = "'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, monospace";

/** Neutral + tint tokens are CSS variables so the theme can switch at runtime. */
export const THEMES = {
  light: {
    bg0: '#F4F4F9', bg1: '#FFFFFF', bg2: '#F8F8FC', bg3: '#EFEEFB',
    b0: '#F0F0F6', b1: '#E8E8F1', b2: '#D8D8E6',
    t1: '#17172B', t2: '#555570', t3: '#6F6F8A',
    'red-bg': '#FEF3F2', 'red-bd': '#FDD0CD', 'red-fg': '#B42318',
    'ind-bg': '#F1F0FE', 'ind-bd': '#D5D1FB', 'ind-fg': '#4136C4',
    'grn-bg': '#ECFDF3', 'grn-bd': '#ABEFC6', 'grn-fg': '#067647',
    'amb-bg': '#FFFAEB', 'amb-bd': '#F7E1A0', 'amb-fg': '#8A5A00',
    'org-bg': '#FFF6ED', 'org-bd': '#FBD9B5', 'org-fg': '#B54708',
    shadow: '0 1px 2px rgba(23,23,43,0.04), 0 8px 24px rgba(23,23,43,0.05)',
    'shadow-sm': '0 1px 2px rgba(23,23,43,0.05)',
    overlay: 'rgba(23,23,43,0.40)',
  },
  dark: {
    bg0: '#0E0E18', bg1: '#171724', bg2: '#1D1D2C', bg3: '#26244F',
    b0: '#1F1F2E', b1: '#2A2A3D', b2: '#3A3A52',
    t1: '#F1F1F8', t2: '#B4B4CC', t3: '#8888A4',
    'red-bg': '#2A1517', 'red-bd': '#5A2528', 'red-fg': '#FF8F8A',
    'ind-bg': '#22204A', 'ind-bd': '#3B3790', 'ind-fg': '#B8AFFF',
    'grn-bg': '#10261D', 'grn-bd': '#1E5A3F', 'grn-fg': '#5FD3A0',
    'amb-bg': '#2A2210', 'amb-bd': '#5C4A16', 'amb-fg': '#F0C75A',
    'org-bg': '#2A1D12', 'org-bd': '#5C3A16', 'org-fg': '#F5A55E',
    shadow: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.25)',
    'shadow-sm': '0 1px 2px rgba(0,0,0,0.4)',
    overlay: 'rgba(0,0,0,0.60)',
  },
};

/** Apply a theme by writing its values to :root. Returns the mode applied. */
export function applyTheme(mode) {
  const t = THEMES[mode] || THEMES.light;
  const root = document.documentElement;
  Object.entries(t).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
  root.setAttribute('data-theme', mode);
  root.style.colorScheme = mode;
  return mode;
}

export function initialTheme() {
  try {
    const saved = localStorage.getItem('cyberx_theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* storage unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const v = name => `var(--${name})`;

export const C = {
  // Surfaces (page → card → inset → selected)
  bg0: v('bg0'), bg1: v('bg1'), bg2: v('bg2'), bg3: v('bg3'),
  // Borders
  b0: v('b0'), b1: v('b1'), b2: v('b2'),
  // Text
  t1: v('t1'), t2: v('t2'), t3: v('t3'),

  // Brand (fixed hex: components build translucent variants from these)
  accent:  '#6A5BF5',
  accentLt: v('bg3'),
  blue:    '#6A5BF5',   // legacy name → accent
  blueLt:  '#6A5BF5',
  indigo:  '#6A5BF5',
  purple:  '#8B6CF6',
  cyan:    '#0EA5C6',
  teal:    '#12A39A',

  // Semantic
  critical: '#E5484D',
  high:     '#F2780C',
  medium:   '#D99A00',
  low:      '#6A5BF5',
  success:  '#12A06B',
  info:     '#8B8BA3',
};

export const SHADOW = v('shadow');
export const SHADOW_SM = v('shadow-sm');

/** Severity colour map — tinted surface, soft border, solid badge, readable text */
export const SEV = {
  critical: { bg: v('red-bg'), border: v('red-bd'), badge: '#E5484D', text: v('red-fg'), glow: '#E5484D14' },
  high:     { bg: v('org-bg'), border: v('org-bd'), badge: '#F2780C', text: v('org-fg'), glow: '#F2780C14' },
  medium:   { bg: v('amb-bg'), border: v('amb-bd'), badge: '#D99A00', text: v('amb-fg'), glow: '#D99A0014' },
  low:      { bg: v('ind-bg'), border: v('ind-bd'), badge: '#6A5BF5', text: v('ind-fg'), glow: '#6A5BF514' },
  info:     { bg: v('bg2'),    border: v('b1'),     badge: '#8B8BA3', text: v('t2'),     glow: '#8B8BA314' },
};

/** Card base style */
export const card = (extra = {}) => ({
  background: C.bg1,
  border: `1px solid ${C.b1}`,
  borderRadius: '16px',
  boxShadow: SHADOW,
  ...extra,
});

/** Section heading style */
export const sectionTitle = {
  color: C.t3,
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom: '12px',
};

/** Small badge pill */
export const pill = (color, bg, border) => ({
  background: bg || `${color}14`,
  color,
  border: `1px solid ${border || `${color}26`}`,
  borderRadius: '999px',
  fontSize: '11px',
  padding: '2px 9px',
  fontWeight: '600',
  whiteSpace: 'nowrap',
});
