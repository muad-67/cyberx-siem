/**
 * ui.jsx — small shared pieces: loading skeletons, empty states, clickable entities.
 */
import React from 'react';
import { C, MONO } from '../theme';
import { useNav } from '../context/nav';

export function Skeleton({ w = '100%', h = 14, style = {} }) {
  return <div className="skeleton" aria-hidden="true" style={{ width: w, height: h, ...style }} />;
}

/** Placeholder shaped like a card — shown while the first fetch is in flight. */
export function CardSkeleton({ lines = 4, height = 220 }) {
  return (
    <div role="status" aria-label="Loading" style={{ minHeight: height, display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 6 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} w={`${92 - i * 11}%`} h={i === 0 ? 20 : 14} />
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }) {
  return (
    <div style={{ margin: 'auto', padding: '32px 16px', textAlign: 'center', maxWidth: 320 }}>
      {icon && (
        <div aria-hidden="true" style={{
          width: 44, height: 44, borderRadius: 14, background: C.bg3, color: C.accent,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
        }}>{icon}</div>
      )}
      <div style={{ color: C.t1, fontSize: 14, fontWeight: 600 }}>{title}</div>
      {body && <div style={{ color: C.t2, fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{body}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

const linkBtn = {
  background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer',
  color: 'inherit', font: 'inherit', textAlign: 'left',
  textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: '3px',
  transition: 'text-decoration-color .15s, color .15s',
};
const hoverOn  = e => { e.currentTarget.style.textDecorationColor = C.accent; e.currentTarget.style.color = C.accent; };
const hoverOff = e => { e.currentTarget.style.textDecorationColor = 'transparent'; e.currentTarget.style.color = 'inherit'; };

/** An IP address that opens its attack timeline when clicked. */
export function IPLink({ ip, style = {} }) {
  const { openTimeline } = useNav();
  if (!ip) return <span style={style}>—</span>;
  return (
    <button type="button" title={`Open timeline for ${ip}`} onClick={() => openTimeline(ip)}
            onMouseEnter={hoverOn} onMouseLeave={hoverOff}
            style={{ ...linkBtn, fontFamily: MONO, ...style }}>{ip}</button>
  );
}

/** A MITRE technique id that opens the ATT&CK map. */
export function TechLink({ id, children, style = {} }) {
  const { go } = useNav();
  return (
    <button type="button" title="Open MITRE ATT&CK map" onClick={() => go('mitre')}
            onMouseEnter={hoverOn} onMouseLeave={hoverOff} style={{ ...linkBtn, ...style }}>
      {children || id}
    </button>
  );
}

/** A hostname that opens the Endpoints page. */
export function HostLink({ host, style = {} }) {
  const { go } = useNav();
  return (
    <button type="button" title="Open Endpoints" onClick={() => go('endpoints')}
            onMouseEnter={hoverOn} onMouseLeave={hoverOff} style={{ ...linkBtn, ...style }}>{host}</button>
  );
}
