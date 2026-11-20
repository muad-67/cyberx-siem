/**
 * Notifications.jsx — bell with unread badge + dropdown, and toast pop-ups for new alerts.
 * useNotifications() holds the state in App; <Bell/> and <Toasts/> render it.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { C, SEV, SHADOW } from '../theme';
import { parseTs } from '../utils/time';

const pretty = s => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export function useNotifications() {
  const [items, setItems] = useState([]);   // newest first, max 30
  const [toasts, setToasts] = useState([]);
  const seen = useRef(new Set());

  const push = useCallback(alert => {
    if (!alert || seen.current.has(alert.id)) return;
    seen.current.add(alert.id);
    setItems(prev => [{ alert, read: false }, ...prev].slice(0, 30));
    if (alert.severity === 'critical' || alert.severity === 'high') {
      setToasts(prev => [...prev, alert].slice(-3));
      setTimeout(() => setToasts(prev => prev.filter(a => a.id !== alert.id)), 7000);
    }
  }, []);

  const markAllRead = useCallback(() => setItems(prev => prev.map(i => ({ ...i, read: true }))), []);
  const dismissToast = useCallback(id => setToasts(prev => prev.filter(a => a.id !== id)), []);
  const unread = items.filter(i => !i.read).length;
  return { items, toasts, unread, push, markAllRead, dismissToast };
}

export function Bell({ n, onOpenAlert }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button" aria-label={`Notifications${n.unread ? `, ${n.unread} unread` : ''}`}
        aria-haspopup="true" aria-expanded={open}
        onClick={() => { setOpen(o => !o); if (!open) n.markAllRead(); }}
        style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
                 background: C.bg1, color: C.t2, boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
        {n.unread > 0 && (
          <span aria-hidden="true" style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99,
                         background: C.critical, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {n.unread > 9 ? '9+' : n.unread}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 340, maxHeight: 420, overflowY: 'auto', zIndex: 60,
                                  background: C.bg1, border: `1px solid ${C.b1}`, borderRadius: 16, boxShadow: SHADOW, padding: 6 }}>
          <div style={{ padding: '10px 12px 6px', color: C.t1, fontSize: 14, fontWeight: 600 }}>Recent alerts</div>
          {n.items.length === 0 ? (
            <div style={{ padding: '18px 12px 22px', color: C.t2, fontSize: 13 }}>Nothing new. New alerts appear here as they happen.</div>
          ) : n.items.map(({ alert }) => {
            const s = SEV[alert.severity] || SEV.info;
            return (
              <button key={alert.id} role="menuitem" type="button" onClick={() => { onOpenAlert(alert.id); setOpen(false); }}
                      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', textAlign: 'left', border: 'none', background: 'transparent',
                               padding: '9px 12px', borderRadius: 10, cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.bg2)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span aria-hidden="true" style={{ marginTop: 6, width: 8, height: 8, borderRadius: '50%', background: s.badge, flexShrink: 0 }} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', color: C.t1, fontSize: 13, fontWeight: 600 }}>{pretty(alert.alert_type)} <span style={{ color: s.text, fontWeight: 500 }}>· {alert.severity}</span></span>
                  <span style={{ display: 'block', color: C.t2, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.source_ip || 'unknown source'}</span>
                </span>
                <span style={{ color: C.t3, fontSize: 12, whiteSpace: 'nowrap' }}>{alert.created_at ? parseTs(alert.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Toasts({ n, onOpenAlert }) {
  return (
    <div aria-live="assertive" style={{ position: 'fixed', right: 20, bottom: 20, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 100 }}>
      {n.toasts.map(a => {
        const s = SEV[a.severity] || SEV.info;
        return (
          <div key={a.id} role="alert" className="slide-in" style={{
            width: 320, background: C.bg1, borderRadius: 16, boxShadow: SHADOW, border: `1px solid ${s.border}`,
            padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ width: 8, alignSelf: 'stretch', borderRadius: 99, background: s.badge, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: s.text, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{a.severity} alert</div>
              <div style={{ color: C.t1, fontSize: 14, fontWeight: 600, marginTop: 2 }}>{pretty(a.alert_type)}</div>
              <div style={{ color: C.t2, fontSize: 12.5, marginTop: 2 }}>from {a.source_ip || 'unknown'}</div>
              <button type="button" onClick={() => { onOpenAlert(a.id); n.dismissToast(a.id); }}
                      style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, color: C.accent, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>View alert</button>
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => n.dismissToast(a.id)}
                    style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
          </div>
        );
      })}
    </div>
  );
}
