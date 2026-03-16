/**
 * MitreMap.jsx
 * MITRE ATT&CK technique coverage heatmap — CyberX SaaS UI.
 * Groups observed techniques by tactic, colour-coded by worst severity.
 */

import React, { useState, useEffect } from 'react';
import { fetchMitreSummary, fetchMitreTechniques } from '../services/api';
import { C, SEV, card } from '../theme';

const SEV_COLOR = {
  critical: C.critical,
  high:     C.high,
  medium:   C.medium,
  low:      C.low,
};

function LegendDot({ color, bg, border, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: C.t2 }}>
      <span style={{
        width: 10, height: 10,
        background: bg || `${color}25`,
        border: `1px solid ${border || color}`,
        borderRadius: '3px',
        display: 'inline-block',
      }} />
      {label}
    </span>
  );
}

function TechCard({ tech, hit }) {
  const [hover, setHover] = useState(false);
  const color = hit ? (SEV_COLOR[hit.max_severity] || C.t3) : null;
  const s     = hit ? (SEV[hit.max_severity] || SEV.info) : null;

  return (
    <a
      href={tech.url}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration: 'none' }}
      title={hit ? `${hit.alert_count} alert(s) — ${hit.max_severity}` : 'Not yet observed'}
    >
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: s ? s.bg : C.bg2,
          border: `1px solid ${color || C.b1}`,
          borderLeft: `3px solid ${color || C.b1}`,
          borderRadius: '8px',
          padding: '10px 12px',
          minWidth: '120px',
          cursor: 'pointer',
          transition: 'all 0.15s',
          boxShadow: hover
            ? (s ? `0 0 16px ${s.glow}` : `0 0 8px ${C.b2}`)
            : 'none',
          transform: hover ? 'translateY(-1px)' : 'none',
        }}
      >
        <div style={{
          color: color || C.t3,
          fontSize: '10px',
          fontWeight: '700',
          letterSpacing: '0.04em',
          marginBottom: '3px',
        }}>
          {tech.technique}
        </div>
        <div style={{
          color: hit ? C.t1 : C.t3,
          fontSize: '11px',
          lineHeight: '1.4',
        }}>
          {tech.name}
        </div>
        {hit && (
          <div style={{
            color,
            fontSize: '9px',
            fontWeight: '700',
            marginTop: '5px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {hit.alert_count} alert{hit.alert_count !== 1 ? 's' : ''} · {hit.max_severity}
          </div>
        )}
      </div>
    </a>
  );
}

export default function MitreMap() {
  const [observed,   setObserved]   = useState([]);
  const [techniques, setTechniques] = useState([]);

  useEffect(() => {
    const load = () => {
      fetchMitreSummary().then(setObserved).catch(() => {});
      fetchMitreTechniques().then(setTechniques).catch(() => {});
    };
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  const observedMap = Object.fromEntries(
    observed.map(o => [o.mitre_technique, o])
  );

  const byTactic = techniques.reduce((acc, t) => {
    const tactic = t.tactic || 'Unknown';
    if (!acc[tactic]) acc[tactic] = [];
    acc[tactic].push(t);
    return acc;
  }, {});

  const observedCount = observed.length;

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ color: C.t1, margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700' }}>
            MITRE ATT&amp;CK Coverage
          </h2>
          <p style={{ color: C.t3, fontSize: '12px', margin: 0 }}>
            Coloured tiles = techniques observed in this environment · Grey = covered but not triggered
          </p>
        </div>
        {observedCount > 0 && (
          <div style={{
            ...card({ padding: '10px 16px', textAlign: 'center' }),
          }}>
            <div style={{ color: C.critical, fontSize: '22px', fontWeight: '800', lineHeight: 1 }}>
              {observedCount}
            </div>
            <div style={{ color: C.t3, fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>
              Observed
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { sev: 'critical', color: C.critical },
          { sev: 'high',     color: C.high },
          { sev: 'medium',   color: C.medium },
          { sev: 'low',      color: C.low },
        ].map(({ sev, color }) => (
          <LegendDot key={sev} color={color} label={sev} />
        ))}
        <LegendDot
          color={C.t3}
          bg={C.bg2}
          border={C.b1}
          label="not observed"
        />
      </div>

      {/* Tactic groups */}
      {Object.entries(byTactic).map(([tactic, techs]) => {
        const hitCount = techs.filter(t => observedMap[t.technique]).length;
        return (
          <div key={tactic} style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{
                color: C.indigo, fontSize: '11px', fontWeight: '700',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                {tactic}
              </div>
              {hitCount > 0 && (
                <span style={{
                  background: '#1e1b4b', color: '#a5b4fc',
                  border: '1px solid #3730a3',
                  borderRadius: '10px', fontSize: '10px',
                  padding: '1px 7px', fontWeight: '700',
                }}>
                  {hitCount} / {techs.length}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {techs.map(t => (
                <TechCard key={t.technique} tech={t} hit={observedMap[t.technique]} />
              ))}
            </div>
          </div>
        );
      })}

      {techniques.length === 0 && (
        <div style={{ color: C.t3, textAlign: 'center', padding: '60px', fontSize: '13px' }}>
          Loading technique list…
        </div>
      )}
    </div>
  );
}
