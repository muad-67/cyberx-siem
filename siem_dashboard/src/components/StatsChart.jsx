/**
 * StatsChart.jsx
 * Attack statistics visualised with Recharts — CyberX SaaS UI.
 *   - Donut pie: alerts by attack type
 *   - Horizontal bar: top attacking IPs
 *   - Area chart: log volume over 24 h
 */

import { parseTs } from '../utils/time';
import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { fetchAlertsByType, fetchTopIPs, fetchHourlyLogs, fetchTopCountries } from '../services/api';
import { C, card } from '../theme';

const PALETTE = [C.critical, C.high, C.medium, C.low, C.purple, C.cyan, C.teal, C.success];

const TT = {
  contentStyle: {
    background: 'var(--bg1)',
    border: `1px solid ${C.b1}`,
    borderRadius: '8px',
    fontSize: '12px',
    boxShadow: '0 8px 24px rgba(23,23,43,0.10)',
  },
  labelStyle: { color: C.t1, fontWeight: '600' },
  itemStyle:  { color: C.t2 },
  cursor:     { fill: `${C.blue}10` },
};

function Panel({ title, children }) {
  return (
    <div style={{
      ...card({ padding: '20px' }),
    }}>
      <h3 style={{
        color: C.t3, margin: '0 0 16px 0',
        fontSize: '10px', fontWeight: '700',
        textTransform: 'uppercase', letterSpacing: '0.12em',
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <div style={{ color: C.t3, fontSize: '12px', textAlign: 'center', padding: '48px 0' }}>
      No data yet
    </div>
  );
}

export default function StatsChart() {
  const [byType,    setByType]    = useState([]);
  const [topIPs,    setTopIPs]    = useState([]);
  const [hourly,    setHourly]    = useState([]);
  const [countries, setCountries] = useState([]);
  const [range,     setRange]     = useState(24);

  useEffect(() => {
    const load = () => {
      fetchAlertsByType().then(setByType).catch(() => {});
      fetchTopIPs().then(setTopIPs).catch(() => {});
      fetchHourlyLogs(range).then(setHourly).catch(() => {});
      fetchTopCountries().then(setCountries).catch(() => {});
    };
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [range]);

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ color: C.t1, margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700' }}>
        Attack Statistics
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Alerts by type — donut */}
        <Panel title="Alerts by Attack Type">
          {byType.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <defs>
                  {byType.map((_, i) => (
                    <radialGradient key={i} id={`grad${i}`}>
                      <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.6} />
                    </radialGradient>
                  ))}
                </defs>
                <Pie data={byType} dataKey="count" nameKey="alert_type"
                     cx="50%" cy="46%" outerRadius={90} innerRadius={40}
                     paddingAngle={2} stroke="var(--bg1)" strokeWidth={3}>
                  {byType.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip {...TT} />
                <Legend
                  iconSize={8} iconType="circle"
                  formatter={v => (
                    <span style={{ color: C.t2, fontSize: '11px' }}>
                      {v.replace(/_/g, ' ')}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Top attacking IPs */}
        <Panel title="Top Attacking IPs">
          {topIPs.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topIPs} layout="vertical" margin={{ left: 8, right: 20 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={C.critical} stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#E5484D" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.b0} />
                <XAxis type="number" stroke={C.b1}
                       tick={{ fill: C.t3, fontSize: 10 }} />
                <YAxis dataKey="source_ip" type="category" stroke={C.b1}
                       tick={{ fill: C.t2, fontSize: 10 }} width={115} />
                <Tooltip {...TT} />
                <Bar dataKey="alert_count" fill={C.accent} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Top attacking countries */}
        <Panel title="Top Attacking Countries (Geo Enrichment)">
          {countries.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={countries} layout="vertical" margin={{ left: 8, right: 20 }}>
                <defs>
                  <linearGradient id="geoGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={C.purple} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={C.indigo} stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.b0} />
                <XAxis type="number" stroke={C.b1} tick={{ fill: C.t3, fontSize: 10 }} />
                <YAxis dataKey="country" type="category" stroke={C.b1}
                       tick={{ fill: C.t2, fontSize: 10 }} width={100} />
                <Tooltip {...TT} />
                <Bar dataKey="count" fill="#B3A5FA" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Log volume — spans both columns */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Panel title={`Log Volume — Last ${range === 24 ? '24 Hours' : range === 168 ? '7 Days' : '30 Days'}`}>
            <div role="group" aria-label="Time range" style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
              {[[24, '24h'], [168, '7d'], [720, '30d']].map(([k, l]) => (
                <button key={k} type="button" aria-pressed={range === k} onClick={() => setRange(k)}
                        style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 12px', fontSize: 12.5, fontWeight: 600,
                                 background: range === k ? C.accent : C.bg2, color: range === k ? '#fff' : C.t2 }}>{l}</button>
              ))}
            </div>
            {hourly.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={hourly} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"   stopColor={C.blue} stopOpacity={0.4} />
                      <stop offset="95%"  stopColor={C.blue} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.b0} />
                  <XAxis dataKey="hour" stroke={C.b1}
                         tick={{ fill: C.t3, fontSize: 9 }}
                         tickFormatter={v => !v ? v : range > 72 ? parseTs(v + ':00').toLocaleDateString([], { month: 'short', day: 'numeric' }) : parseTs(v + ':00').toLocaleTimeString([], { hour: 'numeric' })} />
                  <YAxis stroke={C.b1} tick={{ fill: C.t3, fontSize: 10 }} />
                  <Tooltip {...TT} />
                  <Area
                    type="monotone" dataKey="count"
                    stroke={C.blue} strokeWidth={2}
                    fill="url(#areaGrad)" dot={false}
                    activeDot={{ r: 4, fill: C.blue, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>

      </div>
    </div>
  );
}
