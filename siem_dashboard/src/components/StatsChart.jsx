/**
 * StatsChart.jsx
 * Attack statistics visualised with Recharts — CyberX SaaS UI.
 *   - Donut pie: alerts by attack type
 *   - Horizontal bar: top attacking IPs
 *   - Area chart: log volume over 24 h
 */

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
    background: C.bg2,
    border: `1px solid ${C.b2}`,
    borderRadius: '8px',
    fontSize: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
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

  useEffect(() => {
    const load = () => {
      fetchAlertsByType().then(setByType).catch(() => {});
      fetchTopIPs().then(setTopIPs).catch(() => {});
      fetchHourlyLogs().then(setHourly).catch(() => {});
      fetchTopCountries().then(setCountries).catch(() => {});
    };
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

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
                     paddingAngle={3} strokeWidth={0}>
                  {byType.map((_, i) => (
                    <Cell key={i} fill={`url(#grad${i})`} />
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
                    <stop offset="100%" stopColor="#ff6b6b" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.b0} />
                <XAxis type="number" stroke={C.b1}
                       tick={{ fill: C.t3, fontSize: 10 }} />
                <YAxis dataKey="source_ip" type="category" stroke={C.b1}
                       tick={{ fill: C.t2, fontSize: 10 }} width={115} />
                <Tooltip {...TT} />
                <Bar dataKey="alert_count" fill="url(#barGrad)" radius={[0, 6, 6, 0]} />
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
                <Bar dataKey="count" fill="url(#geoGrad)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Log volume — spans both columns */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Panel title="Log Volume — Last 24 Hours">
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
                         tickFormatter={v => (v || '').split(' ')[1] || v} />
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
