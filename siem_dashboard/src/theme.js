/**
 * theme.js — CyberX Design System
 * Shared color + style constants used by every component.
 */

export const C = {
  // Backgrounds (darkest → lightest)
  bg0: '#060b18',   // page
  bg1: '#0a1225',   // sidebar / card
  bg2: '#0f1a35',   // hover / inner card
  bg3: '#162040',   // active / selected

  // Borders
  b0: '#111e38',    // subtle
  b1: '#172540',    // default
  b2: '#1e3258',    // prominent

  // Text
  t1: '#e8f2ff',    // primary
  t2: '#7da5c8',    // secondary
  t3: '#3d617f',    // muted

  // Brand / accents
  blue:   '#3b82f6',
  blueLt: '#60a5fa',
  indigo: '#6366f1',
  purple: '#8b5cf6',
  cyan:   '#06b6d4',
  teal:   '#14b8a6',

  // Semantic
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#3b82f6',
  success:  '#10b981',
  info:     '#475569',
};

/** Severity colour map — returns full palette for bg, border, badge, text */
export const SEV = {
  critical: { bg: '#0f0505', border: '#7f1d1d', badge: '#dc2626', text: '#fca5a5', glow: '#ef444430' },
  high:     { bg: '#0f0800', border: '#7c2d12', badge: '#ea580c', text: '#fdba74', glow: '#f9731630' },
  medium:   { bg: '#0e0c00', border: '#713f12', badge: '#ca8a04', text: '#fde047', glow: '#eab30830' },
  low:      { bg: '#020814', border: '#1e3a8a', badge: '#2563eb', text: '#93c5fd', glow: '#3b82f630' },
  info:     { bg: '#0a1225', border: '#172540', badge: '#475569', text: '#94a3b8', glow: '#47556930' },
};

/** Card base style */
export const card = (extra = {}) => ({
  background: C.bg1,
  border: `1px solid ${C.b1}`,
  borderRadius: '12px',
  ...extra,
});

/** Section heading style */
export const sectionTitle = {
  color: C.t3,
  fontSize: '10px',
  fontWeight: '700',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  marginBottom: '12px',
};

/** Small badge pill */
export const pill = (color, bg, border) => ({
  background: bg || `${color}15`,
  color,
  border: `1px solid ${border || `${color}30`}`,
  borderRadius: '4px',
  fontSize: '10px',
  padding: '2px 8px',
  fontWeight: '600',
  whiteSpace: 'nowrap',
});
