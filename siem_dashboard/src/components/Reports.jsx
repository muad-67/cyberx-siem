/**
 * Reports.jsx — CyberX SIEM Reports Page
 * Daily / weekly threat summaries, export to CSV/JSON.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchDailyReport, fetchWeeklyReport, exportAlerts, fetchStorageStats } from '../services/api';
import { C, card, sectionTitle, pill } from '../theme';


function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ ...card(), padding: '18px 20px', flex: 1, minWidth: '130px' }}>
      <div style={{ color: C.t3, fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ color: color || C.t1, fontSize: '28px', fontWeight: '700', letterSpacing: '-1px' }}>
        {value ?? '—'}
      </div>
      {sub && <div style={{ color: C.t3, fontSize: '11px', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

export default function Reports() {
  const [period, setPeriod]       = useState(1);
  const [daily, setDaily]         = useState(null);
  const [weekly, setWeekly]       = useState(null);
  const [storage, setStorage]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFmt, setExportFmt] = useState('csv');
  const [exportDays, setExportDays] = useState(7);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, w, s] = await Promise.all([
        fetchDailyReport(period),
        fetchWeeklyReport(),
        fetchStorageStats(),
      ]);
      setDaily(d);
      setWeekly(w);
      setStorage(s);
    } catch (e) {
      console.error('Reports load error', e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try {
      if (exportFmt === 'csv') {
        const blob = await exportAlerts('csv', exportDays);
        const url = URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `cyberx_alerts_${exportDays}d.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await exportAlerts('json', exportDays);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cyberx_alerts_${exportDays}d.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Export error', e);
    } finally {
      setExporting(false);
    }
  };

  const summary   = daily?.summary || {};
  const sevBreak  = summary.severity_breakdown || {};
  const statBreak = summary.status_breakdown || {};
  const topIPs    = daily?.top_attacking_ips || [];
  const mitreRows = daily?.mitre_techniques || [];
  const alertTypes = daily?.alert_types || [];
  const trendData = weekly?.daily_trend || [];

  const periodLabel = period === 1 ? 'Last 24 Hours' : period === 7 ? 'Last 7 Days' : `Last ${period} Days`;

  return (
    <div style={{ padding: '28px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ color: C.t1, fontSize: '18px', fontWeight: '700', letterSpacing: '-0.4px' }}>
            Threat Reports
          </div>
          <div style={{ color: C.t3, fontSize: '12px', marginTop: '3px' }}>
            {periodLabel} — {daily?.report_metadata?.generated_at?.slice(0, 16).replace('T', ' ')} UTC
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {[1, 7, 30].map(d => (
            <button key={d} onClick={() => setPeriod(d)} style={{
              padding: '6px 14px', borderRadius: '6px', border: `1px solid ${period === d ? C.blue : C.b1}`,
              background: period === d ? `${C.blue}20` : 'transparent',
              color: period === d ? C.blueLt : C.t2, cursor: 'pointer', fontSize: '12px', fontWeight: '600',
            }}>
              {d === 1 ? '24h' : `${d}d`}
            </button>
          ))}
          <button onClick={load} disabled={loading} style={{
            padding: '6px 14px', borderRadius: '6px', border: `1px solid ${C.b1}`,
            background: 'transparent', color: C.t2, cursor: 'pointer', fontSize: '12px',
          }}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <StatCard label="Total Alerts"  value={summary.total_alerts}  sub={periodLabel} color={C.t1} />
        <StatCard label="Critical"      value={sevBreak.critical || 0} color={C.critical} />
        <StatCard label="High"          value={sevBreak.high || 0}     color={C.high} />
        <StatCard label="Logs Ingested" value={summary.total_logs}     color={C.t2} />
        <StatCard label="Open Alerts"   value={statBreak.open || 0}    color={C.medium} />
        <StatCard label="Resolved"      value={statBreak.resolved || 0} color={C.success} />
      </div>

      {/* Weekly trend chart */}
      <div style={{ ...card(), padding: '20px', marginBottom: '20px' }}>
        <div style={sectionTitle}>7-Day Alert Trend</div>
        {trendData.length === 0 ? (
          <div style={{ color: C.t3, fontSize: '13px', textAlign: 'center', padding: '30px 0' }}>No trend data</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData}>
              <XAxis dataKey="date" tick={{ fill: C.t3, fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fill: C.t3, fontSize: 10 }} />
              <Tooltip contentStyle={{ background: C.bg2, border: `1px solid ${C.b2}`, borderRadius: '8px', color: C.t1, fontSize: '12px' }} />
              <Line type="monotone" dataKey="alerts" stroke={C.critical} strokeWidth={2} dot={{ r: 3, fill: C.critical }} name="Alerts" />
              <Line type="monotone" dataKey="logs"   stroke={C.blue}     strokeWidth={1.5} dot={false} name="Logs" strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Two-column: Alert Types + Top IPs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>

        {/* Alert types */}
        <div style={{ ...card(), padding: '20px' }}>
          <div style={sectionTitle}>Alert Types</div>
          {alertTypes.length === 0 ? (
            <div style={{ color: C.t3, fontSize: '13px' }}>No alerts in period</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={alertTypes} layout="vertical">
                <XAxis type="number" tick={{ fill: C.t3, fontSize: 10 }} />
                <YAxis dataKey="alert_type" type="category" tick={{ fill: C.t2, fontSize: 10 }} width={130} />
                <Tooltip contentStyle={{ background: C.bg2, border: `1px solid ${C.b2}`, borderRadius: '8px', color: C.t1, fontSize: '12px' }} />
                <Bar dataKey="count" fill={C.blue} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top IPs */}
        <div style={{ ...card(), padding: '20px' }}>
          <div style={sectionTitle}>Top Attacking IPs</div>
          {topIPs.length === 0 ? (
            <div style={{ color: C.t3, fontSize: '13px' }}>No attack IPs in period</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topIPs.map((ip, i) => (
                <div key={ip.source_ip} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: C.t3, fontSize: '10px', width: '14px', textAlign: 'right' }}>{i + 1}</span>
                  <span style={{ color: C.t1, fontSize: '13px', fontFamily: 'monospace', flex: 1 }}>{ip.source_ip}</span>
                  <span style={{ ...pill(C.critical), fontSize: '11px' }}>{ip.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MITRE techniques */}
      <div style={{ ...card(), padding: '20px', marginBottom: '20px' }}>
        <div style={sectionTitle}>MITRE ATT&CK Techniques Observed</div>
        {mitreRows.length === 0 ? (
          <div style={{ color: C.t3, fontSize: '13px' }}>No techniques observed in period</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {mitreRows.map(r => (
              <div key={r.mitre_technique} style={{
                background: C.bg2, border: `1px solid ${C.b2}`, borderRadius: '8px',
                padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span style={{ color: C.blue, fontSize: '11px', fontWeight: '700', fontFamily: 'monospace' }}>
                  {r.mitre_technique}
                </span>
                <span style={{ color: C.t2, fontSize: '11px' }}>{r.mitre_name}</span>
                <span style={{ ...pill(C.t3), fontSize: '10px' }}>{r.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Storage stats + Export */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Storage */}
        <div style={{ ...card(), padding: '20px' }}>
          <div style={sectionTitle}>Storage Stats</div>
          {storage ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                ['Total Logs',      storage.total_logs],
                ['DB Size',         `${storage.db_size_mb} MB`],
                ['Retention Policy', `${storage.retention_days} days`],
                ['Oldest Log',      storage.oldest_log?.slice(0, 10) || 'N/A'],
                ['Newest Log',      storage.newest_log?.slice(0, 10) || 'N/A'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.t3, fontSize: '12px' }}>{k}</span>
                  <span style={{ color: C.t1, fontSize: '12px', fontWeight: '600' }}>{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: C.t3, fontSize: '13px' }}>Loading…</div>
          )}
        </div>

        {/* Export */}
        <div style={{ ...card(), padding: '20px' }}>
          <div style={sectionTitle}>Export Alerts</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['csv', 'json'].map(f => (
                <button key={f} onClick={() => setExportFmt(f)} style={{
                  padding: '6px 16px', borderRadius: '6px', border: `1px solid ${exportFmt === f ? C.blue : C.b1}`,
                  background: exportFmt === f ? `${C.blue}20` : 'transparent',
                  color: exportFmt === f ? C.blueLt : C.t2, cursor: 'pointer',
                  fontSize: '12px', fontWeight: '600', textTransform: 'uppercase',
                }}>
                  {f}
                </button>
              ))}
            </div>
            <div>
              <label style={{ color: C.t3, fontSize: '11px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                Period
              </label>
              <select
                value={exportDays}
                onChange={e => setExportDays(Number(e.target.value))}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '6px',
                  background: C.bg2, border: `1px solid ${C.b2}`,
                  color: C.t1, fontSize: '13px', cursor: 'pointer',
                }}
              >
                <option value={1}>Last 24 Hours</option>
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Days</option>
              </select>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{
                padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: exporting ? 'var(--ind-bd)' : 'linear-gradient(90deg, #6A5BF5, #6A5BF5)',
                color: '#fff', fontWeight: '600', fontSize: '13px',
                opacity: exporting ? 0.7 : 1, transition: 'opacity 0.15s',
              }}
            >
              {exporting ? 'Exporting…' : `Download ${exportFmt.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
