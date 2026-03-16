/**
 * Overview.jsx — CyberX SIEM home dashboard
 * Stat cards · alert type chart · top IPs · activity timeline · recent alerts
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { fetchOverview, fetchAlerts, fetchAlertsByType, fetchHourlyLogs, fetchTopIPs } from '../services/api';
import { useSSE } from '../services/useSSE';
import { C, SEV } from '../theme';

// ── Design constants ──────────────────────────────────────────────────────────
const CHART_TOOLTIP = {
  contentStyle: { background: '#0f1a35', border: '1px solid #1e3258', borderRadius: '8px', fontSize: '12px' },
  labelStyle:   { color: '#e8f2ff' },
  itemStyle:    { color: '#7da5c8' },
  cursor:       { fill: '#ffffff08' },
};

const PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981'];

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, subtitle, icon }) {
  return (
    <div style={{
      background: C.bg1, borderRadius: '12px',
      border: `1px solid ${C.b1}`,
      padding: '20px 22px', flex: 1, minWidth: '140px',
      position: 'relative', overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Glow blob */}
      <div style={{
        position: 'absolute', top: -24, right: -24,
        width: '80px', height: '80px',
        background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
        borderRadius: '50%', pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <span style={{ color: C.t3, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {label}
        </span>
        {icon && <span style={{ fontSize: '16px', opacity: 0.6 }}>{icon}</span>}
      </div>
      <div style={{ color, fontSize: '34px', fontWeight: '800', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>
        {value ?? '—'}
      </div>
      {subtitle && (
        <div style={{ color: C.t3, fontSize: '11px', marginTop: '6px' }}>{subtitle}</div>
      )}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Panel({ title, action, children, style = {} }) {
  return (
    <div style={{ background: C.bg1, borderRadius: '12px', border: `1px solid ${C.b1}`, ...style }}>
      <div style={{
        padding: '16px 20px 14px',
        borderBottom: `1px solid ${C.b0}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: C.t2, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </span>
        {action}
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  );
}

// ── Recent alerts row ─────────────────────────────────────────────────────────
function AlertRow({ alert }) {
  const s = SEV[alert.severity] || SEV.info;
  return (
    <div className="slide-in" style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '9px 0', borderBottom: `1px solid ${C.b0}`,
    }}>
      <span style={{
        flexShrink: 0, width: '6px', height: '6px', borderRadius: '50%',
        background: s.badge, boxShadow: `0 0 6px ${s.badge}80`,
      }} />
      <span style={{
        flexShrink: 0, background: `${s.badge}20`, color: s.badge,
        border: `1px solid ${s.badge}40`, borderRadius: '4px',
        fontSize: '9px', fontWeight: '700', padding: '2px 6px',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {alert.severity}
      </span>
      <span style={{ flex: 1, color: C.t1, fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {alert.alert_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
      </span>
      {alert.source_ip && (
        <span style={{ color: C.t3, fontSize: '11px', flexShrink: 0, fontFamily: 'monospace' }}>
          {alert.source_ip}
        </span>
      )}
      <span style={{ color: C.t3, fontSize: '10px', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
      {alert.mitre_technique && (
        <span style={{
          flexShrink: 0, background: '#1e1b4b', color: '#a5b4fc',
          border: '1px solid #3730a3', borderRadius: '4px',
          fontSize: '9px', padding: '2px 6px', fontWeight: '600',
        }}>
          {alert.mitre_technique}
        </span>
      )}
    </div>
  );
}

// ── Custom pie label ──────────────────────────────────────────────────────────
const renderPieLabel = ({ cx, cy, midAngle, outerRadius, name, percent }) => {
  if (percent < 0.07) return null;
  const rad = midAngle * Math.PI / 180;
  const x = cx + (outerRadius + 18) * Math.cos(-rad);
  const y = cy + (outerRadius + 18) * Math.sin(-rad);
  return (
    <text x={x} y={y} fill="#7da5c8" fontSize={9} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {name}
    </text>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export default function Overview({ onNavigate }) {
  const [stats,    setStats]    = useState(null);
  const [alerts,   setAlerts]   = useState([]);
  const [byType,   setByType]   = useState([]);
  const [hourly,   setHourly]   = useState([]);
  const [topIPs,   setTopIPs]   = useState([]);

  const loadAll = useCallback(() => {
    fetchOverview().then(setStats).catch(() => {});
    fetchAlerts({ status: 'open', limit: 6 }).then(setAlerts).catch(() => {});
    fetchAlertsByType().then(setByType).catch(() => {});
    fetchHourlyLogs().then(setHourly).catch(() => {});
    fetchTopIPs().then(setTopIPs).catch(() => {});
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // SSE keeps stats + alerts updated in real time
  const handleNewAlert = useCallback(a => {
    setAlerts(prev => [a, ...prev].slice(0, 6));
    setStats(prev => prev ? {
      ...prev,
      total_alerts: (prev.total_alerts || 0) + 1,
      open_alerts:  (prev.open_alerts  || 0) + 1,
      critical_alerts: a.severity === 'critical' ? (prev.critical_alerts || 0) + 1 : prev.critical_alerts,
    } : prev);
  }, []);

  const handleStats = useCallback(s => setStats(s), []);
  useSSE({ onAlert: handleNewAlert, onStats: handleStats });

  // Refresh charts every 30s
  useEffect(() => {
    const id = setInterval(() => {
      fetchAlertsByType().then(setByType).catch(() => {});
      fetchHourlyLogs().then(setHourly).catch(() => {});
      fetchTopIPs().then(setTopIPs).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1440px' }}>

      {/* ── Page heading ─────────────────────────────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: C.t1, fontSize: '20px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>
          Security Overview
        </h1>
        <p style={{ color: C.t3, fontSize: '13px', margin: '4px 0 0' }}>
          Real-time threat intelligence · MITRE ATT&amp;CK mapped
        </p>
      </div>

      {/* ── Stat cards ───────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <StatCard label="Total Logs"    value={stats?.total_logs}      color="#3b82f6"  icon="📋" subtitle="events ingested" />
        <StatCard label="Total Alerts"  value={stats?.total_alerts}    color="#f97316"  icon="🔔" subtitle="detections fired" />
        <StatCard label="Open Alerts"   value={stats?.open_alerts}     color="#eab308"  icon="⚠️" subtitle="require triage" />
        <StatCard label="Critical"      value={stats?.critical_alerts} color="#ef4444"  icon="🔴" subtitle="high priority" />
        <StatCard label="Blocked IPs"   value={stats?.blocked_ips}     color="#8b5cf6"  icon="🚫" subtitle="access denied" />
      </div>

      {/* ── Row 2: pie + bar ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>

        {/* Alert types pie */}
        <Panel title="Alerts by Attack Type">
          {byType.length === 0
            ? <EmptyState text="No alert data yet — run the simulator" />
            : (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={byType} dataKey="count" nameKey="alert_type"
                    cx="50%" cy="45%" outerRadius={80} innerRadius={36}
                    paddingAngle={3} labelLine={false} label={renderPieLabel}
                  >
                    {byType.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    {...CHART_TOOLTIP}
                    formatter={(v, n) => [v, n.replace(/_/g, ' ')]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )
          }
        </Panel>

        {/* Top IPs bar */}
        <Panel title="Top Attacking IPs">
          {topIPs.length === 0
            ? <EmptyState text="No attacker data yet" />
            : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={topIPs} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#111e38" horizontal={false} />
                  <XAxis type="number" stroke="#172540" tick={{ fill: '#3d617f', fontSize: 10 }} axisLine={false} />
                  <YAxis dataKey="source_ip" type="category" stroke="#172540"
                    tick={{ fill: '#7da5c8', fontSize: 10, fontFamily: 'monospace' }} width={112} axisLine={false} />
                  <Tooltip {...CHART_TOOLTIP} formatter={v => [v, 'alerts']} />
                  <Bar dataKey="alert_count" fill="#ef4444" radius={[0, 6, 6, 0]}
                    background={{ fill: '#0a1225', radius: 6 }} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </Panel>
      </div>

      {/* ── Row 3: activity chart (full width) ───────────────── */}
      <div style={{ marginBottom: '14px' }}>
        <Panel title="Log Volume — Last 24 Hours">
          {hourly.length === 0
            ? <EmptyState text="No activity data yet" />
            : (
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={hourly} margin={{ left: -10, right: 10 }}>
                  <defs>
                    <linearGradient id="logGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#111e38" vertical={false} />
                  <XAxis dataKey="hour" stroke="#172540" tick={{ fill: '#3d617f', fontSize: 9 }}
                    tickFormatter={v => (v || '').split(' ')[1] || v} axisLine={false} />
                  <YAxis stroke="#172540" tick={{ fill: '#3d617f', fontSize: 10 }} axisLine={false} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2}
                    fill="url(#logGrad)" dot={false} activeDot={{ r: 4, fill: '#3b82f6', stroke: '#060b18', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )
          }
        </Panel>
      </div>

      {/* ── Row 4: recent alerts ─────────────────────────────── */}
      <Panel
        title="Recent Open Alerts"
        action={
          <button onClick={() => onNavigate?.('alerts')} style={{
            background: 'rgba(59,130,246,0.1)', color: C.blueLt,
            border: '1px solid rgba(59,130,246,0.25)', borderRadius: '6px',
            fontSize: '11px', padding: '4px 12px', cursor: 'pointer', fontWeight: '600',
          }}>
            View All →
          </button>
        }
      >
        {alerts.length === 0
          ? <EmptyState text="No open alerts — system is quiet" icon="✓" green />
          : alerts.map(a => <AlertRow key={a.id} alert={a} />)
        }
      </Panel>

    </div>
  );
}

function EmptyState({ text, icon = '◌', green }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 0', color: green ? C.success : C.t3, fontSize: '13px' }}>
      <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.4 }}>{icon}</div>
      {text}
    </div>
  );
}
