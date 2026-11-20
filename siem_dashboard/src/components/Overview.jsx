/**
 * Overview.jsx — CyberX home dashboard
 * Welcome header · KPI cards · log volume · attack types · top attackers
 * · alerts by type · recent alerts · quick insights
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { parseTs } from '../utils/time';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { fetchOverview, fetchAlerts, fetchAlertsByType, fetchHourlyLogs, fetchTopIPs } from '../services/api';
import { useSSE } from '../services/useSSE';
import { C, SEV, SHADOW } from '../theme';
import { CardSkeleton, EmptyState, IPLink } from './ui';

const TOOLTIP = {
  contentStyle: { background: 'var(--bg1)', border: `1px solid ${C.b1}`, borderRadius: '12px', fontSize: '12px', boxShadow: SHADOW, padding: '8px 12px' },
  labelStyle:   { color: C.t1, fontWeight: 600, marginBottom: 2 },
  itemStyle:    { color: C.t2, padding: 0 },
  cursor:       { stroke: C.b2, strokeDasharray: '4 4' },
};

// Quiet, related hues — one family instead of a rainbow
const SLICES = ['#6A5BF5', '#8B6CF6', '#B3A5FA', 'var(--ind-bd)', '#E5484D', '#F2780C', '#D99A00'];

// Server buckets are UTC ("YYYY-MM-DD HH:00" up to 72h, "YYYY-MM-DD 00:00" per day beyond).
// Fill the whole range (missing buckets = 0) and label each in the viewer's local time.
const RANGES = [
  { key: 24,  label: '24h', sub: 'Events per hour, last 24 hours' },
  { key: 168, label: '7d',  sub: 'Events per day, last 7 days' },
  { key: 720, label: '30d', sub: 'Events per day, last 30 days' },
];

function buildSeries(rows, hours) {
  const byKey = new Map((rows || []).map(r => [r.hour, r.count]));
  const daily = hours > 72;
  const steps = daily ? Math.ceil(hours / 24) : hours;
  const now = new Date();
  const out = [];
  for (let i = steps - 1; i >= 0; i--) {
    const d = daily
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() - i));
    const key = daily ? d.toISOString().slice(0, 10) + ' 00:00' : d.toISOString().slice(0, 13).replace('T', ' ') + ':00';
    out.push({
      hour: key, count: byKey.get(key) || 0,
      label: daily ? d.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' })
                   : d.toLocaleTimeString([], { hour: 'numeric' }),
    });
  }
  return out;
}

const pretty = s => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const nf = n => (n ?? 0).toLocaleString();

// ── Building blocks ───────────────────────────────────────────────────────────
function Card({ title, subtitle, action, children, style = {}, pad = '20px' }) {
  return (
    <section className="lift" style={{
      background: C.bg1, borderRadius: '20px', boxShadow: SHADOW, padding: pad,
      display: 'flex', flexDirection: 'column', minWidth: 0, ...style,
    }}>
      {(title || action) && (
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, color: C.t1, fontSize: '15px', fontWeight: '600', letterSpacing: '-0.01em' }}>{title}</h3>
            {subtitle && <div style={{ color: C.t3, fontSize: '12.5px', marginTop: '2px' }}>{subtitle}</div>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

function TextLink({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', color: C.accent, fontSize: '13px',
      fontWeight: '600', cursor: 'pointer', padding: 0,
    }}>{children}</button>
  );
}

function Kpi({ label, value, hint, icon, chip }) {
  return (
    <div className="lift" style={{
      background: C.bg1, borderRadius: '20px', boxShadow: SHADOW, padding: '18px 20px', minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: C.t2, fontSize: '13px', fontWeight: '500' }}>
        <span style={{ display: 'inline-flex', color: C.t3 }}>{icon}</span>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
        <span style={{ color: C.t1, fontSize: '30px', fontWeight: '700', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {value == null ? '—' : nf(value)}
        </span>
        {chip}
      </div>
      <div style={{ color: C.t3, fontSize: '12.5px', marginTop: '8px' }}>{hint}</div>
    </div>
  );
}

function Chip({ tone = 'neutral', children }) {
  const tones = {
    up:      { bg: 'var(--grn-bg)', fg: 'var(--grn-fg)' },
    down:    { bg: 'var(--red-bg)', fg: 'var(--red-fg)' },
    neutral: { bg: C.bg3,     fg: C.accent  },
  };
  const t = tones[tone];
  return (
    <span style={{ background: t.bg, color: t.fg, borderRadius: '999px', padding: '3px 9px', fontSize: '12px', fontWeight: '600' }}>
      {children}
    </span>
  );
}

function SevBadge({ severity }) {
  const s = SEV[severity] || SEV.info;
  return (
    <span style={{
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      borderRadius: '999px', padding: '2px 10px', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize',
    }}>{severity}</span>
  );
}

const I = {
  logs:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  bell:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>,
  alert:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  block:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></svg>,
  clock:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  target: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  globe:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/></svg>,
};

const btn = (primary) => ({
  border: primary ? 'none' : `1px solid ${C.b1}`,
  background: primary ? C.accent : C.bg1,
  color: primary ? '#fff' : C.t1,
  borderRadius: '12px', padding: '10px 16px', fontSize: '13.5px', fontWeight: '600',
  cursor: 'pointer', boxShadow: primary ? '0 4px 12px rgba(106,91,245,0.28)' : 'none',
});

// ── Main component ────────────────────────────────────────────────────────────
export default function Overview({ onNavigate, user }) {
  const [stats,  setStats]  = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [byType, setByType] = useState(null);
  const [hourlyRaw, setHourly] = useState(null);
  const [range, setRange] = useState(24);
  const [topIPs, setTopIPs] = useState(null);

  const loadAll = useCallback(() => {
    fetchOverview().then(setStats).catch(() => {});
    fetchAlerts({ status: 'open', limit: 5 }).then(setAlerts).catch(() => {});
    fetchAlertsByType().then(setByType).catch(() => {});
    fetchTopIPs().then(setTopIPs).catch(() => {});
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Log-volume chart reloads whenever the range changes (and every 30s)
  useEffect(() => {
    const load = () => fetchHourlyLogs(range).then(setHourly).catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [range]);

  const handleNewAlert = useCallback(a => {
    setAlerts(prev => [a, ...(prev || [])].slice(0, 5));
    setStats(prev => prev ? {
      ...prev,
      total_alerts: (prev.total_alerts || 0) + 1,
      open_alerts:  (prev.open_alerts  || 0) + 1,
      critical_alerts: a.severity === 'critical' ? (prev.critical_alerts || 0) + 1 : prev.critical_alerts,
    } : prev);
  }, []);
  useSSE({ onAlert: handleNewAlert, onStats: useCallback(s => setStats(s), []) });

  useEffect(() => {
    const id = setInterval(() => {
      fetchAlertsByType().then(setByType).catch(() => {});
      fetchTopIPs().then(setTopIPs).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // ── Derived numbers (all from real data) ────────────────────────────────────
  const hourly = useMemo(() => buildSeries(hourlyRaw, range), [hourlyRaw, range]);
  const typeData = byType || [];
  const ipData = topIPs || [];
  const typeTotal = typeData.reduce((n, t) => n + (t.count || 0), 0);
  const topType   = typeData[0];
  const topShare  = typeTotal && topType ? Math.round((topType.count / typeTotal) * 100) : 0;

  const hourChip = useMemo(() => {   // logs this hour vs the hour before
    if (range !== 24 || hourly.length < 2) return null;
    const cur = hourly[hourly.length - 1].count, prev = hourly[hourly.length - 2].count;
    if (!prev) return null;
    const pct = Math.round(((cur - prev) / prev) * 100);
    return <Chip tone={pct >= 0 ? 'up' : 'down'}>{pct >= 0 ? '+' : ''}{pct}%</Chip>;
  }, [hourly, range]);

  const busiest = useMemo(
    () => hourly.reduce((m, h) => (!m || h.count > m.count ? h : m), null), [hourly]);
  const maxIP = Math.max(1, ...ipData.map(t => t.alert_count));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = user?.username || 'there';

  const axis = { stroke: 'transparent', tick: { fill: C.t3, fontSize: 11 }, axisLine: false, tickLine: false };

  const loading = stats === null;

  const emptyCta = (label, page) => <button style={btn(false)} onClick={() => onNavigate?.(page)}>{label}</button>;

  return (
    <div style={{ padding: '4px 4px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', margin: '4px 8px 20px' }}>
        <div>
          <h1 style={{ margin: 0, color: C.t1, fontSize: '26px', fontWeight: '700', letterSpacing: '-0.03em' }}>
            {greeting}, {name}
          </h1>
          <p style={{ margin: '6px 0 0', color: C.t2, fontSize: '14px' }}>
            {loading ? 'Loading your latest activity…'
              : stats.open_alerts
                ? `${nf(stats.open_alerts)} open ${stats.open_alerts === 1 ? 'alert needs' : 'alerts need'} your attention.`
                : 'Nothing needs your attention right now.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={btn(false)} onClick={() => onNavigate?.('logs')}>Live log feed</button>
          <button style={btn(true)}  onClick={() => onNavigate?.('alerts')}>Review alerts</button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid-kpi">
        <Kpi label="Events ingested" value={stats?.total_logs}      icon={I.logs}  hint="All time" chip={hourChip} />
        <Kpi label="Open alerts"     value={stats?.open_alerts}     icon={I.bell}  hint={`${nf(stats?.total_alerts)} detections in total`} />
        <Kpi label="Critical"        value={stats?.critical_alerts} icon={I.alert} hint="Highest priority"
             chip={stats?.critical_alerts > 0 ? <Chip tone="down">Act now</Chip> : null} />
        <Kpi label="Blocked IPs"     value={stats?.blocked_ips}     icon={I.block} hint="Currently denied access" />
      </div>

      {/* Row 2 */}
      <div className="grid-row2">

        <Card title="Log volume" subtitle={RANGES.find(r => r.key === range).sub}
              action={
                <div role="group" aria-label="Time range" style={{ display: 'flex', gap: 4, background: C.bg2, padding: 3, borderRadius: 10 }}>
                  {RANGES.map(r => (
                    <button key={r.key} type="button" aria-pressed={range === r.key} onClick={() => setRange(r.key)}
                            style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 10px', fontSize: 12.5, fontWeight: 600,
                                     background: range === r.key ? C.bg1 : 'transparent', color: range === r.key ? C.t1 : C.t3,
                                     boxShadow: range === r.key ? 'var(--shadow-sm)' : 'none' }}>{r.label}</button>
                  ))}
                </div>
              }>
          {hourlyRaw === null ? <CardSkeleton height={230} /> : hourlyRaw.length === 0 ? (
            <EmptyState icon={I.logs} title="No events in this period"
                        body="Start the Mac agent, or send some test attacks with the simulator, and activity shows up here."
                        action={emptyCta('See how to connect a source', 'endpoints')} />
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={hourly} margin={{ left: -6, right: 6, top: 6 }}>
                <defs>
                  <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={C.accent} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.b0} vertical={false} />
                <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={36} />
                <YAxis {...axis} width={52} tickFormatter={v => (v >= 1000 ? `${v / 1000}k` : v)} />
                <Tooltip {...TOOLTIP} formatter={v => [nf(v), 'events']} />
                <Area type="monotone" dataKey="count" stroke={C.accent} strokeWidth={2.2}
                      fill="url(#vol)" dot={false} activeDot={{ r: 5, fill: C.accent, stroke: 'var(--bg1)', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Attack types" subtitle="Share of all alerts">
          {byType === null ? <CardSkeleton height={230} /> : typeData.length === 0 ? (
            <EmptyState icon={I.target} title="No attacks detected yet" body="Detections will be split out by type here." />
          ) : (
            <div style={{ position: 'relative', flex: 1, minHeight: 230 }}>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={typeData} dataKey="count" nameKey="alert_type" innerRadius={62} outerRadius={96}
                       paddingAngle={2} startAngle={90} endAngle={-270} stroke="var(--bg1)" strokeWidth={3}>
                    {typeData.map((_, i) => <Cell key={i} fill={SLICES[i % SLICES.length]} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP} formatter={(v, n) => [v, pretty(n)]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ color: C.t2, fontSize: '12px', maxWidth: 90, textAlign: 'center' }}>{pretty(topType?.alert_type)}</span>
                <span style={{ color: C.t1, fontSize: '24px', fontWeight: '700', letterSpacing: '-0.02em' }}>{topShare}%</span>
              </div>
            </div>
          )}
        </Card>

        <Card title="Top attackers" subtitle="By alerts raised"
              action={<TextLink onClick={() => onNavigate?.('timeline')}>Timeline</TextLink>}>
          {topIPs === null ? <CardSkeleton height={200} /> : ipData.length === 0 ? (
            <EmptyState icon={I.globe} title="No attackers yet" body="Sources that trigger alerts are ranked here. Click one to see everything it did." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {ipData.slice(0, 4).map(ip => (
                <div key={ip.source_ip} style={{ background: C.bg2, borderRadius: '14px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <IPLink ip={ip.source_ip} style={{ color: C.t1, fontSize: '13px', fontWeight: '600' }} />
                    <span style={{ color: C.t2, fontSize: '12.5px', fontVariantNumeric: 'tabular-nums' }}>{ip.alert_count}</span>
                  </div>
                  <div style={{ height: '6px', background: C.b1, borderRadius: '99px', marginTop: '10px', overflow: 'hidden' }}>
                    <div style={{ width: `${(ip.alert_count / maxIP) * 100}%`, height: '100%', background: C.accent, borderRadius: '99px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Row 3 */}
      <div className="grid-row3">

        <Card title="Alerts by technique" subtitle="Detections per rule">
          {byType === null ? <CardSkeleton height={220} /> : typeData.length === 0 ? (
            <EmptyState icon={I.alert} title="Nothing to chart yet" body="Each rule's detections will be compared here." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeData.slice(0, 6)} margin={{ left: -24, right: 4, top: 4 }}>
                <XAxis dataKey="alert_type" {...axis} tickFormatter={v => { const w = pretty(v).split(' ')[0]; return w.length > 7 ? w.slice(0, 6) + '…' : w; }} interval={0} tick={{ fill: C.t3, fontSize: 10 }} />
                <YAxis {...axis} allowDecimals={false} />
                <Tooltip {...TOOLTIP} cursor={{ fill: C.bg2 }} formatter={(v, n, p) => [v, pretty(p.payload.alert_type)]} />
                <Bar dataKey="count" radius={[8, 8, 8, 8]} maxBarSize={28} fill={C.b2}>
                  {typeData.slice(0, 6).map((_, i) => <Cell key={i} fill={i === 0 ? C.accent : 'var(--ind-bd)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Recent alerts" subtitle="Still open"
              action={<TextLink onClick={() => onNavigate?.('alerts')}>View all</TextLink>} pad="20px 20px 8px">
          {alerts === null ? <CardSkeleton height={220} /> : alerts.length === 0 ? (
            <EmptyState icon={I.bell} title="All clear" body="No open alerts. New detections will appear here the moment they fire." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <caption className="sr-only">Open alerts</caption>
                <thead>
                  <tr>
                    {['Severity', 'Type', 'Source', 'Time'].map(h => (
                      <th key={h} scope="col" style={{ textAlign: 'left', color: C.t3, fontWeight: '500', fontSize: '12px', padding: '0 8px 10px 0', borderBottom: `1px solid ${C.b1}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alerts.map(a => (
                    <tr key={a.id} className="slide-in">
                      <td style={{ padding: '11px 8px 11px 0', borderBottom: `1px solid ${C.b0}` }}><SevBadge severity={a.severity} /></td>
                      <td style={{ padding: '11px 8px 11px 0', borderBottom: `1px solid ${C.b0}`, color: C.t1, fontWeight: '500' }}>
                        {pretty(a.alert_type)}
                        {a.occurrences > 1 && <span title={`Seen ${a.occurrences} times`} style={{ marginLeft: 8, color: C.t3, fontSize: 12, fontWeight: 500 }}>×{a.occurrences}</span>}
                      </td>
                      <td style={{ padding: '11px 8px 11px 0', borderBottom: `1px solid ${C.b0}`, color: C.t2, fontSize: '12px' }}><IPLink ip={a.source_ip} /></td>
                      <td style={{ padding: '11px 0', borderBottom: `1px solid ${C.b0}`, color: C.t3, whiteSpace: 'nowrap' }}>
                        {parseTs(a.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Quick read" subtitle="Pulled from your data">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Insight icon={I.clock}  title="Busiest period"
                     body={busiest && busiest.count ? `${busiest.label} with ${nf(busiest.count)} events` : 'Waiting for events'} />
            <Insight icon={I.target} title="Most common attack"
                     body={topType ? `${pretty(topType.alert_type)}, ${topShare}% of alerts` : 'No alerts yet'} />
            <Insight icon={I.globe}  title="Most active source"
                     body={ipData[0] ? `${ipData[0].source_ip} (${ipData[0].alert_count} alerts)` : 'No attackers seen'} />
          </div>
          <div style={{ flex: 1, minHeight: '14px' }} />
          <button style={{ ...btn(true), width: '100%' }} onClick={() => onNavigate?.('mitre')}>
            Open ATT&amp;CK map
          </button>
        </Card>
      </div>
    </div>
  );
}

function Insight({ icon, title, body }) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: C.bg2, borderRadius: '14px', padding: '12px 14px' }}>
      <span style={{ width: 32, height: 32, borderRadius: 10, background: C.bg1, color: C.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 2px rgba(23,23,43,0.06)' }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: C.t1, fontSize: '13px', fontWeight: '600' }}>{title}</div>
        <div style={{ color: C.t2, fontSize: '12.5px', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{body}</div>
      </div>
    </div>
  );
}
