/**
 * AlertPanel.jsx
 * SOC analyst triage panel — redesigned for CyberX SaaS UI.
 *
 * SSE:      new alerts appear instantly (event: alert from /api/stream).
 * REST poll: every 8s to catch status changes (resolved/investigating).
 * Fallback:  polls every 4s when SSE is disconnected.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAlerts, fetchIncidentReport, updateAlertStatus, blockIP, checkThreatIntel } from '../services/api';
import { useSSE } from '../services/useSSE';
import { C, SEV, card, pill } from '../theme';

/* ─── tiny helpers ───────────────────────────────────────────────── */

function MitreBadge({ technique, name }) {
  if (!technique) return null;
  return (
    <a href={`https://attack.mitre.org/techniques/${technique}/`}
       target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
      <span style={{
        background: '#1e1b4b', color: '#a5b4fc',
        fontSize: '10px', padding: '2px 8px',
        borderRadius: '4px', border: '1px solid #3730a3',
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
        {technique} · {name}
      </span>
    </a>
  );
}

function ActionBtn({ label, onClick, color = C.blue, bg, border }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? (bg || `${color}25`) : (bg || `${color}15`),
        color,
        border: `1px solid ${border || `${color}40`}`,
        padding: '4px 11px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: '600',
        transition: 'background 0.15s',
      }}
    >
      {label}
    </button>
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
      background: 'rgba(0,0,0,0.75)',
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
        background: '#1e2a3a', color: '#60a5fa', border: '1px solid #1d4ed8',
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
      background: malicious ? '#450a0a' : '#052e16',
      color: malicious ? '#fca5a5' : '#86efac',
      border: `1px solid ${malicious ? '#7f1d1d' : '#14532d'}`,
      borderRadius: '4px', fontSize: '10px', padding: '2px 8px', fontWeight: '700',
    }}>
      TI {ti.abuse_score} {malicious ? '⚠ Malicious' : '✓ Clean'}{ti.country_code ? ` · ${ti.country_code}` : ''}
    </span>
  );
}

/* ─── Alert Card ─────────────────────────────────────────────────── */

function AlertCard({ alert, onChangeStatus, onBlock, onReport, onTimeline }) {
  const s = SEV[alert.severity] || SEV.info;

  return (
    <div style={{
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderLeft: `3px solid ${s.badge}`,
      borderRadius: '10px',
      padding: '14px 16px',
      marginBottom: '8px',
      boxShadow: `0 0 20px ${s.glow}`,
      transition: 'box-shadow 0.2s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            ...pill(s.badge, `${s.badge}25`, `${s.badge}50`),
            textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            {alert.severity}
          </span>
          <span style={{ color: C.t1, fontWeight: '700', fontSize: '13px', letterSpacing: '0.02em' }}>
            {alert.alert_type.replace(/_/g, ' ').toUpperCase()}
          </span>
          <span style={{ color: C.t3, fontSize: '11px' }}>#{alert.id}</span>
          {alert.risk_score != null && (
            <span style={{
              background: alert.risk_score >= 80 ? '#450a0a' : alert.risk_score >= 60 ? '#1c0900' : alert.risk_score >= 40 ? '#1a1200' : C.bg2,
              color: alert.risk_score >= 80 ? '#fca5a5' : alert.risk_score >= 60 ? '#fdba74' : alert.risk_score >= 40 ? '#fde047' : C.t3,
              border: `1px solid ${alert.risk_score >= 80 ? '#7f1d1d' : alert.risk_score >= 60 ? '#7c2d12' : alert.risk_score >= 40 ? '#713f12' : C.b1}`,
              borderRadius: '4px', fontSize: '10px', padding: '2px 7px', fontWeight: '700',
            }}>
              RISK {alert.risk_score}
            </span>
          )}
        </div>
        <span style={{ color: C.t3, fontSize: '11px' }}>
          {new Date(alert.created_at).toLocaleString()}
        </span>
      </div>

      {/* Description */}
      <div style={{ color: C.t2, fontSize: '12px', lineHeight: '1.5', marginBottom: '10px' }}>
        {alert.description}
      </div>

      {/* Badges row */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <MitreBadge technique={alert.mitre_technique} name={alert.mitre_name} />
        {alert.mitre_tactic && (
          <span style={{ background: '#1e1b4b', color: '#818cf8', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', border: '1px solid #3730a3' }}>
            {alert.mitre_tactic}
          </span>
        )}
        {alert.source_ip && (
          <span style={{ ...pill('#fca5a5', '#450a0a', '#7f1d1d') }}>
            SRC: {alert.source_ip}
          </span>
        )}
        <span style={{ ...pill(C.t3, C.bg2, C.b1) }}>
          {alert.status}
        </span>
        {alert.source_ip && <TIBadge ip={alert.source_ip} />}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {alert.status === 'open' && (
          <ActionBtn label="Investigate" onClick={() => onChangeStatus(alert.id, 'investigating')} color={C.blue} />
        )}
        {alert.status === 'investigating' && (
          <ActionBtn label="Resolve" onClick={() => onChangeStatus(alert.id, 'resolved')} color={C.success} />
        )}
        {alert.source_ip && alert.status !== 'resolved' && (
          <ActionBtn label={`Block ${alert.source_ip}`} onClick={() => onBlock(alert)}
                     color="#fca5a5" bg="#450a0a" border="#7f1d1d" />
        )}
        {alert.source_ip && (
          <ActionBtn label="Timeline" onClick={() => onTimeline(alert.source_ip)}
                     color="#a78bfa" bg="#1e1b4b" border="#3730a3" />
        )}
        <ActionBtn label="Report" onClick={() => onReport(alert.id)} color={C.t2} bg={C.bg2} border={C.b2} />
        {alert.status === 'open' && (
          <ActionBtn label="False Positive" onClick={() => onChangeStatus(alert.id, 'false_positive')}
                     color={C.t3} bg="transparent" border={C.b1} />
        )}
      </div>
    </div>
  );
}

/* ─── Filter Pill ────────────────────────────────────────────────── */

function FilterPill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? C.blue : C.bg2,
      color:      active ? '#fff' : C.t2,
      border: `1px solid ${active ? C.blue : C.b1}`,
      padding: '4px 12px',
      borderRadius: '20px',
      cursor: 'pointer',
      fontSize: '11px',
      fontWeight: '600',
      transition: 'all 0.15s',
    }}>
      {label}
    </button>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */

export default function AlertPanel({ onTimeline }) {
  const [alerts, setAlerts]     = useState([]);
  const [filter, setFilter]     = useState('open');
  const [loading, setLoading]   = useState(true);
  const [reportId, setReportId] = useState(null);
  const filterRef               = useRef('open');

  useEffect(() => { filterRef.current = filter; }, [filter]);

  const loadAll = useCallback(() => {
    const f = filterRef.current;
    fetchAlerts(f ? { status: f, limit: 100 } : { limit: 100 })
      .then(rows => { setAlerts(rows); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    loadAll();
  }, [filter, loadAll]);

  const handleNewAlert = useCallback(alert => {
    const f = filterRef.current;
    if (f && alert.status !== f) return;
    setAlerts(prev => {
      if (prev.some(a => a.id === alert.id)) return prev;
      return [alert, ...prev];
    });
  }, []);

  const { sseOk } = useSSE({ onAlert: handleNewAlert });

  useEffect(() => {
    const interval = sseOk ? 8000 : 4000;
    const id = setInterval(loadAll, interval);
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

  const FILTERS = [
    { value: 'open',          label: 'Open' },
    { value: 'investigating', label: 'Investigating' },
    { value: 'resolved',      label: 'Resolved' },
    { value: '',              label: 'All' },
  ];

  return (
    <div style={{ padding: '20px' }}>
      {reportId && <ReportModal alertId={reportId} onClose={() => setReportId(null)} />}

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ color: C.t1, margin: 0, fontSize: '18px', fontWeight: '700' }}>
            Security Alerts
          </h2>
          <span style={{
            background: C.bg3, color: C.t2, border: `1px solid ${C.b2}`,
            borderRadius: '20px', fontSize: '11px', padding: '2px 10px', fontWeight: '600',
          }}>
            {alerts.length}
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: sseOk ? '#052e16' : '#422006',
            color:      sseOk ? C.success   : '#f97316',
            border: `1px solid ${sseOk ? '#14532d' : '#7c2d12'}`,
            borderRadius: '20px', fontSize: '10px', padding: '2px 8px', fontWeight: '700',
          }}>
            <span className={sseOk ? 'pulse' : ''} style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: sseOk ? C.success : '#f97316', display: 'inline-block',
            }} />
            {sseOk ? 'LIVE' : 'POLLING'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <FilterPill
              key={f.value}
              label={f.label}
              active={filter === f.value}
              onClick={() => setFilter(f.value)}
            />
          ))}
        </div>
      </div>

      {/* Alert list */}
      {loading && (
        <div style={{ color: C.t3, fontSize: '13px', textAlign: 'center', padding: '32px' }}>
          Loading alerts…
        </div>
      )}

      {!loading && alerts.length === 0 && (
        <div style={{
          ...card({ padding: '60px', textAlign: 'center' }),
          color: C.t3, fontSize: '14px',
        }}>
          No alerts for this filter.
        </div>
      )}

      {alerts.map(alert => (
        <AlertCard
          key={alert.id}
          alert={alert}
          onChangeStatus={changeStatus}
          onBlock={handleBlock}
          onReport={setReportId}
          onTimeline={onTimeline || (() => {})}
        />
      ))}
    </div>
  );
}
