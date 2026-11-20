/**
 * GlobalSearch.jsx — one box for IPs, hostnames, alerts and MITRE techniques.
 * Press "/" anywhere to focus it. Arrow keys + Enter to pick a result.
 */
import React, { useEffect, useRef, useState } from 'react';
import { searchAll } from '../services/api';
import { useNav } from '../context/nav';
import { C, SHADOW, MONO } from '../theme';

const pretty = s => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function GlobalSearch() {
  const nav = useNav();
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  // "/" focuses the search (unless typing in a field already)
  useEffect(() => {
    const onKey = e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (e.key === '/' && !['input', 'textarea', 'select'].includes(tag) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault(); inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onDoc = e => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // debounce
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return undefined; }
    const t = setTimeout(() => {
      searchAll(q.trim()).then(r => { setRes(r); setCursor(0); }).catch(() => setRes(null));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const items = res ? [
    ...res.ips.map(i => ({ key: `ip-${i.source_ip}`, group: 'IP addresses', label: i.source_ip, mono: true, meta: `${i.events} events`, run: () => nav.openTimeline(i.source_ip) })),
    ...res.hosts.map(h => ({ key: `h-${h.hostname}`, group: 'Endpoints', label: h.hostname, meta: h.source_ip, run: () => nav.go('endpoints') })),
    ...res.alerts.map(a => ({ key: `a-${a.id}`, group: 'Alerts', label: `#${a.id} ${pretty(a.alert_type)}`, meta: `${a.severity}${a.source_ip ? ' · ' + a.source_ip : ''}`, run: () => nav.openAlert(a.id) })),
  ] : [];

  const choose = it => { it.run(); setOpen(false); setQ(''); setRes(null); inputRef.current?.blur(); };

  const onKeyDown = e => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && items[cursor]) { e.preventDefault(); choose(items[cursor]); }
  };

  let lastGroup = null;
  return (
    <div ref={boxRef} style={{ position: 'relative', width: 'min(340px, 40vw)' }}>
      <label htmlFor="global-search" className="sr-only">Search IPs, hosts and alerts</label>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, background: C.bg1, borderRadius: 999,
        padding: '8px 14px', boxShadow: 'var(--shadow-sm)',
      }}>
        <svg width="15" height="15" fill="none" stroke={C.t3} strokeWidth="1.8" strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          id="global-search" ref={inputRef} value={q} autoComplete="off"
          role="combobox" aria-expanded={open && items.length > 0} aria-controls="search-results"
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
          placeholder="Search IP, host, alert…"
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, color: C.t1 }}
        />
        <kbd aria-hidden="true" style={{ fontSize: 11, color: C.t3, border: `1px solid ${C.b1}`, borderRadius: 6, padding: '1px 6px' }}>/</kbd>
      </div>

      {open && q.trim().length >= 2 && (
        <div id="search-results" role="listbox" style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 50, maxHeight: 360, overflowY: 'auto',
          background: C.bg1, borderRadius: 16, boxShadow: SHADOW, border: `1px solid ${C.b1}`, padding: 6,
        }}>
          {items.length === 0 ? (
            <div style={{ padding: '14px 12px', color: C.t2, fontSize: 13 }}>{res ? `No matches for “${q.trim()}”` : 'Searching…'}</div>
          ) : items.map((it, i) => {
            const head = it.group !== lastGroup ? (lastGroup = it.group) : null;
            return (
              <React.Fragment key={it.key}>
                {head && <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, padding: '8px 10px 4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>{head}</div>}
                <div role="option" aria-selected={i === cursor} onMouseEnter={() => setCursor(i)} onClick={() => choose(it)}
                     style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                              background: i === cursor ? C.bg3 : 'transparent' }}>
                  <span style={{ color: C.t1, fontSize: 13, fontWeight: 500, fontFamily: it.mono ? MONO : 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
                  <span style={{ color: C.t3, fontSize: 12, whiteSpace: 'nowrap' }}>{it.meta}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
