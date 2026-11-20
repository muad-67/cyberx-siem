/**
 * AlertPanel.jsx
 * SOC analyst triage panel — redesigned for CyberX SaaS UI.
 *
 * SSE:      new alerts appear instantly (event: alert from /api/stream).
 * REST poll: every 8s to catch status changes (resolved/investigating).
 * Fallback:  polls every 4s when SSE is disconnected.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { parseTs } from "../utils/time";
import { fetchAlerts, fetchIncidentReport, updateAlertStatus, blockIP, checkThreatIntel } from '../services/api';
import { useSSE } from '../services/useSSE';
import { C, SEV, card, SHADOW, MONO } from '../theme';
import { IPLink, EmptyState, CardSkeleton } from './ui';

/* ─── tiny helpers ───────────────────────────────────────────────── */

function MitreBadge({ technique, name }) {
  if (!technique) return null;
  return (
    <a href={`https://attack.mitre.org/techniques/${technique}/`}
       target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
      <span style={{
        background: 'var(--ind-bg)', color: 'var(--ind-fg)',
        fontSize: '10px', padding: '2px 8px',
        borderRadius: '4px', border: '1px solid var(--ind-bd)',
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
        {technique} · {name}
      </span>
    </a>
  );
}

/* ─── Incident Report Modal ───────────────────────────────────────── */

function ReportModal({ alertId, onClose }) {
  const [report, setReport] = useState(null);
  useEffect(() => {
    fetchIncidentReport(alertId)
      .then(setReport)
      .catch(() => setReport({ error: 'Failed to load' }));
  }, [alertId]);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--overlay)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div className="slide-in" style={{
        ...card({ padding: '28px', maxWidth: '640px', width: '92%',
                   maxHeight: '80vh', overflowY: 'auto', border: `1px solid ${C.b2}` }),
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ color: C.t3, fontSize: '10px', fontWeight: '700',
                          letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>
              Incident Report
            </div>
            <h3 style={{ color: C.t1, margin: 0, fontSize: '18px', fontWeight: '700' }}>
              Alert #{alertId}
            </h3>
          </div>
          <button onClick={onClose} style={{
            background: C.bg3, border: `1px solid ${C.b2}`, color: C.t2,
            width: '32px', height: '32px', borderRadius: '8px',
            cursor: 'pointer', fontSize: '16px', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {!report && (
          <div style={{ color: C.t3, textAlign: 'center', padding: '32px', fontSize: '13px' }}>
            Loading report…
          </div>
        )}
        {report && (
          <pre style={{
            color: C.t2, fontSize: '11px', whiteSpace: 'pre-wrap',
            wordBreak: 'break-word', lineHeight: '1.6',
            background: C.bg0, border: `1px solid ${C.b1}`,
            borderRadius: '8px', padding: '16px', margin: 0,
          }}>
            {JSON.stringify(report, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

/* ─── TI Badge ───────────────────────────────────────────────────── */

function TIBadge({ ip }) {
  const [ti, setTi]     = useState(null);
  const [loading, setLoading] = useState(false);

  const check = () => {
    if (loading || ti) return;
    setLoading(true);
    checkThreatIntel(ip)
      .then(setTi)
      .catch(() => setTi({ source: 'error' }))
      .finally(() => setLoading(false));
  };

  if (!ip) return null;
  if (loading) return <span style={{ color: C.t3, fontSize: '10px' }}>checking TI…</span>;

  if (!ti) {
    return (
      <button onClick={check} style={{
        background: 'var(--b1)', color: '#6A5BF5', border: '1px solid var(--ind-fg)',
        borderRadius: '4px', fontSize: '10px', padding: '2px 8px', cursor: 'pointer',
      }}>
        Check Reputation
      </button>
    );
  }

  if (ti.source === 'private' || ti.source === 'not_configured' || ti.source === 'error') {
    return (
      <span style={{ background: C.bg2, color: C.t3, border: `1px solid ${C.b1}`, borderRadius: '4px', fontSize: '10px', padding: '2px 8px' }}>
        TI: {ti.source}
      </span>
    );
  }

  const malicious = ti.is_malicious || ti.abuse_score >= 25;
  return (
    <span style={{
      background: malicious ? 'var(--red-bg)' : 'var(--grn-bg)',
      color: malicious ? 'var(--red-fg)' : 'var(--grn-fg)',
      border: `1px solid ${malicious ? 'var(--red-bd)' : 'var(--grn-bd)'}`,
      borderRadius: '4px', fontSize: '10px', padding: '2px 8px', fontWeight: '700',
    }}>
      TI {ti.abuse_score} {malicious ? '⚠ Malicious' : '✓ Clean'}{ti.country_code ? ` · ${ti.country_code}` : ''}
    </span>
  );
}

/* ─── Pieces ─────────────────────────────────────────────────────── */

const pretty = s => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const STATUS_LABEL = { open: 'Open', investigating: 'Investigating', resolved: 'Resolved', false_positive: 'False positive' };

function SevBadge({ severity }) {
  const s = SEV[severity] || SEV.info;
  return (
    <span style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}`, borderRadius: 999,
                   padding: '2px 10px', fontSize: 12, fontWeight: 600, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {severity}
    </span>
  );
}

function Btn({ children, onClick, kind = 'secondary', disabled }) {
  const kinds = {
    primary:   { background: C.accent, color: '#fff', border: 'none' },
    secondary: { background: C.bg1, color: C.t1, border: `1px solid ${C.b1}` },
    danger:    { background: 'var(--red-bg)', color: 'var(--red-fg)', border: '1px solid var(--red-bd)' },
    ghost:     { background: 'transparent', color: C.t2, border: `1px solid ${C.b1}` },
  };
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{
      ...kinds[kind], borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
    }}>{children}</button>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} style={{
      background: active ? C.accent : C.bg1, color: active ? '#fff' : C.t2,
      border: `1px solid ${active ? C.accent : C.b1}`, borderRadius: 999, padding: '5px 13px',
      cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all .15s',
    }}>{children}</button>
  );
}

function AlertRow({ alert, selected, onSelect }) {
  const s = SEV[alert.severity] || SEV.info;
  return (
    <button type="button" onClick={() => onSelect(alert.id)} aria-pressed={selected}
            style={{
              display: 'grid', gridTemplateColumns: '10px 92px minmax(0,1fr) auto', alignItems: 'center', gap: 12,
              width: '100%', textAlign: 'left', cursor: 'pointer', padding: '12px 14px', borderRadius: 14, marginBottom: 2,
              border: `1px solid ${selected ? C.accent : 'transparent'}`, background: selected ? C.bg3 : 'transparent',
              transition: 'background .12s',
            }}
            onMouseEnter={e => { if (!selected) e.currentTarget.style.background = C.bg2; }}
            onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: s.badge }} />
      <SevBadge severity={alert.severity} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', color: C.t1, fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pretty(alert.alert_type)}
          {alert.occurrences > 1 && <span title={`Fired ${alert.occurrences} times`} style={{ marginLeft: 8, color: C.t3, fontWeight: 500, fontSize: 12 }}>×{alert.occurrences}</span>}
        </span>
        <span style={{ display: 'block', color: C.t2, fontSize: 12.5, marginTop: 1, fontFamily: MONO }}>{alert.source_ip || 'unknown source'}</span>
      </span>
      <span style={{ textAlign: 'right' }}>
        <span style={{ display: 'block', color: C.t3, fontSize: 12, whiteSpace: 'nowrap' }}>
          {parseTs(alert.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
        <span style={{ display: 'block', color: C.t3, fontSize: 12 }}>{STATUS_LABEL[alert.status] || alert.status}</span>
      </span>
    </button>
  );
}

function Detail({ alert, onChangeStatus, onBlock, onReport, onTimeline, onClose }) {
  const s = SEV[alert.severity] || SEV.info;
  const [more, setMore] = useState(false);
  const risk = alert.risk_score;
  const riskTone = risk >= 80 ? 'red' : risk >= 60 ? 'org' : risk >= 40 ? 'amb' : null;

  return (
    <aside aria-label={`Alert ${alert.id} details`} style={{ ...card({ padding: 0, overflow: 'hidden' }), position: 'sticky', top: 0 }}>
      <div style={{ padding: '18px 20px', background: s.bg, borderBottom: `1px solid ${s.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SevBadge severity={alert.severity} />
          <button type="button" aria-label="Close details" onClick={onClose}
                  style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <h3 style={{ margin: '10px 0 2px', color: C.t1, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{pretty(alert.alert_type)}</h3>
        <div style={{ color: C.t2, fontSize: 12.5 }}>
          Alert #{alert.id} · {parseTs(alert.created_at).toLocaleString()}
          {alert.occurrences > 1 && <> · fired <b style={{ color: C.t1 }}>{alert.occurrences}×</b></>}
        </div>
      </div>

      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, color: C.t1, fontSize: 13.5, lineHeight: 1.55 }}>{alert.description}</p>

        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 13 }}>
          <dt style={{ color: C.t3 }}>Source</dt>
          <dd style={{ margin: 0, color: C.t1 }}><IPLink ip={alert.source_ip} /></dd>
          <dt style={{ color: C.t3 }}>Status</dt>
          <dd style={{ margin: 0, color: C.t1 }}>{STATUS_LABEL[alert.status] || alert.status}</dd>
          {risk != null && (<>
            <dt style={{ color: C.t3 }}>Risk score</dt>
            <dd style={{ margin: 0 }}>
              <span style={{ color: riskTone ? `var(--${riskTone}-fg)` : C.t1, fontWeight: 700 }}>{risk}</span>
              <span style={{ color: C.t3 }}> / 100</span>
            </dd>
          </>)}
          {alert.mitre_technique && (<>
            <dt style={{ color: C.t3 }}>MITRE</dt>
            <dd style={{ margin: 0 }}><MitreBadge technique={alert.mitre_technique} name={alert.mitre_name} /></dd>
          </>)}
          {alert.mitre_tactic && (<>
            <dt style={{ color: C.t3 }}>Tactic</dt>
            <dd style={{ margin: 0, color: C.t1 }}>{alert.mitre_tactic}</dd>
          </>)}
          {alert.source_ip && (<>
            <dt style={{ color: C.t3 }}>Reputation</dt>
            <dd style={{ margin: 0 }}><TIBadge ip={alert.source_ip} /></dd>
          </>)}
        </dl>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {alert.status === 'open' && <Btn kind="primary" onClick={() => onChangeStatus(alert.id, 'investigating')}>Start investigating</Btn>}
          {alert.status === 'investigating' && <Btn kind="primary" onClick={() => onChangeStatus(alert.id, 'resolved')}>Mark resolved</Btn>}
          {(alert.status === 'resolved' || alert.status === 'false_positive') && <Btn kind="secondary" onClick={() => onChangeStatus(alert.id, 'open')}>Reopen</Btn>}
          {alert.source_ip && <Btn kind="secondary" onClick={() => onTimeline(alert.source_ip)}>View timeline</Btn>}
          <div style={{ position: 'relative' }}>
            <Btn kind="ghost" onClick={() => setMore(m => !m)}>More ▾</Btn>
            {more && (
              <div role="menu" style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 6px)', minWidth: 190, zIndex: 20,
                                        background: C.bg1, border: `1px solid ${C.b1}`, borderRadius: 12, boxShadow: SHADOW, padding: 6 }}>
                {[
                  { label: 'View full report', run: () => onReport(alert.id) },
                  alert.source_ip && alert.status !== 'resolved' && { label: `Block ${alert.source_ip}`, run: () => onBlock(alert), danger: true },
                  alert.status === 'open' && { label: 'Mark false positive', run: () => onChangeStatus(alert.id, 'false_positive') },
                ].filter(Boolean).map(item => (
                  <button key={item.label} role="menuitem" type="button" onClick={() => { item.run(); setMore(false); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '8px 10px', borderRadius: 8,
                                   cursor: 'pointer', fontSize: 13, fontWeight: 500, color: item.danger ? 'var(--red-fg)' : C.t1 }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.bg2)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */

const SEVERITIES = ['critical', 'high', 'medium', 'low'];

export default function AlertPanel({ onTimeline, focusId }) {
  const [alerts, setAlerts]     = useState(null);
  const [filter, setFilter]     = useState(focusId ? '' : 'open');
  const [sevFilter, setSevFilter] = useState('');
  const [query, setQuery]       = useState('');
  const [selected, setSelected] = useState(focusId || null);
  const [reportId, setReportId] = useState(null);
  const filterRef               = useRef(filter);

  useEffect(() => { filterRef.current = filter; }, [filter]);
  useEffect(() => { if (focusId) { setFilter(''); setSelected(focusId); } }, [focusId]);

  const loadAll = useCallback(() => {
    const f = filterRef.current;
    fetchAlerts(f ? { status: f, limit: 200 } : { limit: 200 })
      .then(rows => setAlerts(rows))
      .catch(() => setAlerts(prev => prev || []));
  }, []);

  useEffect(() => { setAlerts(null); loadAll(); }, [filter, loadAll]);

  const handleNewAlert = useCallback(alert => {
    const f = filterRef.current;
    if (f && alert.status !== f) return;
    setAlerts(prev => {
      if (!prev || prev.some(a => a.id === alert.id)) return prev;
      return [alert, ...prev];
    });
  }, []);

  const { sseOk } = useSSE({ onAlert: handleNewAlert });

  useEffect(() => {
    const id = setInterval(loadAll, sseOk ? 8000 : 4000);
    return () => clearInterval(id);
  }, [sseOk, loadAll]);

  const changeStatus = async (alertId, status) => {
    await updateAlertStatus(alertId, status).catch(() => {});
    loadAll();
  };

  const handleBlock = async alert => {
    if (!alert.source_ip) return;
    await blockIP(alert.source_ip, `Blocked from alert #${alert.id}`, alert.id).catch(() => {});
    loadAll();
  };

  const STATUS_FILTERS = [
    { value: 'open', label: 'Open' }, { value: 'investigating', label: 'Investigating' },
    { value: 'resolved', label: 'Resolved' }, { value: '', label: 'All' },
  ];

  const q = query.trim().toLowerCase();
  const visible = (alerts || []).filter(a =>
    (!sevFilter || a.severity === sevFilter) &&
    (!q || `${a.alert_type} ${a.source_ip || ''} ${a.mitre_technique || ''} ${a.description || ''}`.toLowerCase().includes(q)));
  const current = (alerts || []).find(a => a.id === selected) || null;

  return (
    <div style={{ padding: '4px 4px 24px' }}>
      {reportId && <ReportModal alertId={reportId} onClose={() => setReportId(null)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', margin: '4px 8px 16px' }}>
        <div>
          <h1 style={{ margin: 0, color: C.t1, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>Alerts</h1>
          <p style={{ margin: '6px 0 0', color: C.t2, fontSize: 14 }}>
            {alerts === null ? 'Loading…' : `${visible.length} shown`}
            <span style={{ color: C.t3 }}> · {sseOk ? 'updating live' : 'refreshing every few seconds'}</span>
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.bg1, borderRadius: 999, padding: '8px 14px', boxShadow: 'var(--shadow-sm)', minWidth: 240 }}>
          <span className="sr-only">Filter alerts</span>
          <svg width="15" height="15" fill="none" stroke={C.t3} strokeWidth="1.8" strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter by type, IP or technique"
                 style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, color: C.t1 }} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 8px 14px', alignItems: 'center' }}>
        {STATUS_FILTERS.map(f => <Chip key={f.label} active={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</Chip>)}
        <span aria-hidden="true" style={{ width: 1, height: 20, background: C.b2, margin: '0 4px' }} />
        <Chip active={!sevFilter} onClick={() => setSevFilter('')}>Any severity</Chip>
        {SEVERITIES.map(sv => <Chip key={sv} active={sevFilter === sv} onClick={() => setSevFilter(sevFilter === sv ? '' : sv)}>{pretty(sv)}</Chip>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: current ? 'minmax(0,1fr) minmax(300px, 400px)' : 'minmax(0,1fr)', gap: 14, alignItems: 'start' }} className="alerts-layout">
        <section aria-label="Alert list" style={{ ...card({ padding: 8 }) }}>
          {alerts === null ? (
            <div style={{ padding: 16 }}><CardSkeleton lines={6} height={260} /></div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
              title={alerts.length ? 'No alerts match these filters' : 'No alerts here'}
              body={alerts.length ? 'Try clearing the severity filter or search.' : 'When a detection rule fires it will show up here straight away.'} />
          ) : visible.map(a => (
            <AlertRow key={a.id} alert={a} selected={a.id === selected} onSelect={id => setSelected(id === selected ? null : id)} />
          ))}
        </section>

        {current && (
          <Detail alert={current} onChangeStatus={changeStatus} onBlock={handleBlock} onReport={setReportId}
                  onTimeline={onTimeline || (() => {})} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  );
}
