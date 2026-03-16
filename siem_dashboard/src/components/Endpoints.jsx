/**
 * Endpoints.jsx
 * Endpoint health monitoring dashboard.
 * Shows online/stale/offline summary cards + a table of all known endpoints.
 * Clicking a row opens a side panel with recent logs and alerts from that host.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { fetchEndpoints, fetchEndpointStats, fetchEndpointDetail } from '../services/api';
import { C, card, pill, sectionTitle } from '../theme';

const STATUS_STYLE = {
  online:  { color: '#86efac', bg: '#052e16', border: '#14532d' },
  stale:   { color: '#fde047', bg: '#1a1200', border: '#713f12' },
  offline: { color: '#fca5a5', bg: '#450a0a', border: '#7f1d1d' },
};

function StatCard({ label, value, color }) {
  return (
    <div style={{
      ...card({ padding: '18px 22px', flex: '1 1 120px', textAlign: 'center' }),
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ color, fontSize: '28px', fontWeight: '800', lineHeight: 1 }}>{value}</div>
      <div style={{ color: C.t3, fontSize: '11px', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.offline;
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: '20px', fontSize: '10px', padding: '2px 10px', fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      {status}
    </span>
  );
}

function DetailPanel({ hostname, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    fetchEndpointDetail(hostname)
      .then(setData)
      .catch(() => setData({ error: 'Failed to load' }));
  }, [hostname]);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      zIndex: 1000,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: '520px', maxWidth: '95vw', height: '100vh',
        background: C.bg1, borderLeft: `1px solid ${C.b1}`,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        padding: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: C.t1, margin: 0, fontSize: '16px', fontWeight: '700' }}>{hostname}</h3>
          <button onClick={onClose} style={{
            background: C.bg3, border: `1px solid ${C.b2}`, color: C.t2,
            width: '30px', height: '30px', borderRadius: '6px',
            cursor: 'pointer', fontSize: '16px',
          }}>×</button>
        </div>

        {!data && <div style={{ color: C.t3, textAlign: 'center', padding: '40px' }}>Loading…</div>}
        {data && data.error && <div style={{ color: C.critical }}>{data.error}</div>}
        {data && !data.error && (
          <>
            {/* Endpoint metadata */}
            <div style={{ ...card({ padding: '14px', marginBottom: '16px' }) }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  ['IP',          data.endpoint.source_ip],
                  ['OS',          data.endpoint.os_type],
                  ['Agent Ver',   data.endpoint.agent_version],
                  ['Log Count',   data.endpoint.log_count],
                  ['First Seen',  data.endpoint.first_seen ? new Date(data.endpoint.first_seen).toLocaleString() : '—'],
                  ['Last Seen',   data.endpoint.last_seen  ? new Date(data.endpoint.last_seen).toLocaleString()  : '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ color: C.t3, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>{k}</div>
                    <div style={{ color: C.t1, fontSize: '12px', fontWeight: '600' }}>{v || '—'}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '10px' }}>
                <StatusBadge status={data.endpoint.status} />
              </div>
            </div>

            {/* Recent alerts */}
            {data.recent_alerts?.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ ...sectionTitle, marginBottom: '8px' }}>Recent Alerts ({data.recent_alerts.length})</div>
                {data.recent_alerts.slice(0, 5).map(a => (
                  <div key={a.id} style={{
                    background: C.bg2, border: `1px solid ${C.b1}`,
                    borderRadius: '6px', padding: '8px 12px', marginBottom: '6px',
                    fontSize: '11px',
                  }}>
                    <span style={{ color: C.critical, fontWeight: '700', marginRight: '8px' }}>
                      {a.alert_type?.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span style={{ color: C.t2 }}>{a.description}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recent logs */}
            <div>
              <div style={{ ...sectionTitle, marginBottom: '8px' }}>Recent Logs ({data.recent_logs?.length || 0})</div>
              <div style={{
                background: '#020810', borderRadius: '8px', border: `1px solid ${C.b0}`,
                maxHeight: '300px', overflowY: 'auto', padding: '10px',
                fontFamily: 'monospace', fontSize: '10px',
              }}>
                {data.recent_logs?.length === 0 && <div style={{ color: C.t3, textAlign: 'center', padding: '20px' }}>No logs.</div>}
                {data.recent_logs?.map(log => (
                  <div key={log.id} style={{ display: 'flex', gap: '10px', padding: '3px 0', borderBottom: `1px solid ${C.b0}` }}>
                    <span style={{ color: C.t3, flexShrink: 0 }}>{new Date(log.created_at).toLocaleTimeString()}</span>
                    <span style={{ color: C.t2 }}>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Endpoints() {
  const [endpoints, setEndpoints] = useState([]);
  const [stats, setStats]         = useState(null);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setFilter] = useState('');

  const load = useCallback(() => {
    Promise.all([fetchEndpoints(), fetchEndpointStats()])
      .then(([eps, st]) => { setEndpoints(eps); setStats(st); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = statusFilter ? endpoints.filter(e => e.status === statusFilter) : endpoints;

  return (
    <div style={{ padding: '20px' }}>
      {selected && <DetailPanel hostname={selected} onClose={() => setSelected(null)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ color: C.t1, margin: 0, fontSize: '18px', fontWeight: '700' }}>Endpoint Health</h2>
        <button onClick={load} style={{
          background: C.bg2, color: C.t2, border: `1px solid ${C.b1}`,
          borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontSize: '11px',
        }}>Refresh</button>
      </div>

      {/* Summary cards */}
      {stats && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <StatCard label="Online"  value={stats.online}  color="#86efac" />
          <StatCard label="Stale"   value={stats.stale}   color="#fde047" />
          <StatCard label="Offline" value={stats.offline} color="#fca5a5" />
          <StatCard label="Total"   value={stats.total}   color={C.t3}    />
        </div>
      )}

      {/* Status filter */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {['', 'online', 'stale', 'offline'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            background: statusFilter === s ? C.blue : C.bg2,
            color:      statusFilter === s ? '#fff' : C.t2,
            border: `1px solid ${statusFilter === s ? C.blue : C.b1}`,
            borderRadius: '20px', padding: '3px 12px', cursor: 'pointer',
            fontSize: '11px', fontWeight: '600',
          }}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: C.t3, textAlign: 'center', padding: '40px' }}>Loading endpoints…</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...card({ padding: '40px', textAlign: 'center' }), color: C.t3, fontSize: '13px' }}>
          No endpoints found.
        </div>
      ) : (
        <div style={{ ...card({ padding: 0, overflow: 'hidden' }) }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: C.bg2, borderBottom: `1px solid ${C.b1}` }}>
                {['Hostname', 'IP Address', 'OS', 'Agent Ver', 'Log Count', 'Last Seen', 'Status'].map(h => (
                  <th key={h} style={{ color: C.t3, padding: '10px 14px', textAlign: 'left', fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((ep, i) => (
                <tr
                  key={ep.id}
                  onClick={() => setSelected(ep.hostname)}
                  style={{
                    background: i % 2 === 0 ? C.bg1 : C.bg0,
                    borderBottom: `1px solid ${C.b0}`,
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg2}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.bg1 : C.bg0}
                >
                  <td style={{ padding: '10px 14px', color: C.t1, fontWeight: '600' }}>{ep.hostname}</td>
                  <td style={{ padding: '10px 14px', color: C.t2 }}>{ep.source_ip || '—'}</td>
                  <td style={{ padding: '10px 14px', color: C.t2 }}>{ep.os_type || '—'}</td>
                  <td style={{ padding: '10px 14px', color: C.t3 }}>{ep.agent_version || '—'}</td>
                  <td style={{ padding: '10px 14px', color: C.t2 }}>{ep.log_count}</td>
                  <td style={{ padding: '10px 14px', color: C.t3, whiteSpace: 'nowrap' }}>
                    {ep.last_seen ? new Date(ep.last_seen).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}><StatusBadge status={ep.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
