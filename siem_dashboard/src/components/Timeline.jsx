/**
 * Timeline.jsx
 * Attack timeline visualization for a given source IP.
 * Shows merged logs + alerts in chronological order, color-coded by type/severity.
 * Analyst can enter an IP (or receive one from AlertPanel via the "Timeline" button).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { parseTs } from "../utils/time";
import { fetchTimeline } from '../services/api';
import { C, card, SEV, sectionTitle } from '../theme';

const SEVERITY_COLOR = {
  critical: '#E5484D',
  high:     '#F2780C',
  medium:   '#D99A00',
  low:      '#6A5BF5',
  info:     '#8B8BA3',
};

const HOURS_OPTIONS = [
  { label: '1h',  value: 1  },
  { label: '6h',  value: 6  },
  { label: '24h', value: 24 },
  { label: '72h', value: 72 },
  { label: '7d',  value: 168 },
];

function TimelineEvent({ event, index }) {
  const isAlert = event.event_type === 'alert';
  const color = isAlert
    ? (SEVERITY_COLOR[event.severity] || '#E5484D')
    : (SEVERITY_COLOR[event.severity] || C.t3);

  const bg     = isAlert ? `${color}15` : C.bg2;
  const border = isAlert ? `${color}40` : C.b1;

  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '4px' }}>
      {/* Spine */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: '10px', height: '10px', borderRadius: '50%',
          background: color, flexShrink: 0,
          boxShadow: isAlert ? `0 0 8px ${color}80` : 'none',
          marginTop: '4px',
        }} />
        <div style={{ width: '1px', flex: 1, background: C.b1, marginTop: '4px', marginBottom: 0 }} />
      </div>

      {/* Content */}
      <div style={{
        ...card({ padding: '10px 14px', marginBottom: '8px', flex: 1 }),
        background: bg, border: `1px solid ${border}`,
        borderLeft: `3px solid ${color}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '4px', marginBottom: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              background: isAlert ? `${color}25` : C.bg3,
              color: isAlert ? color : C.t2,
              border: `1px solid ${isAlert ? `${color}50` : C.b2}`,
              borderRadius: '4px', fontSize: '9px', padding: '1px 6px',
              fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
              {isAlert ? 'ALERT' : event.log_type || 'LOG'}
            </span>
            {event.severity && (
              <span style={{
                color, fontSize: '9px', fontWeight: '700',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {event.severity}
              </span>
            )}
            {event.mitre_technique && (
              <span style={{
                background: 'var(--ind-bg)', color: 'var(--ind-fg)',
                border: '1px solid var(--ind-bd)', borderRadius: '4px',
                fontSize: '9px', padding: '1px 6px',
              }}>
                {event.mitre_technique}
              </span>
            )}
            {event.mitre_tactic && (
              <span style={{ color: '#6A5BF5', fontSize: '10px' }}>{event.mitre_tactic}</span>
            )}
          </div>
          <span style={{ color: C.t3, fontSize: '10px', whiteSpace: 'nowrap' }}>
            {event.timestamp ? parseTs(event.timestamp).toLocaleString() : '—'}
          </span>
        </div>

        <div style={{ color: isAlert ? C.t1 : C.t2, fontSize: '11px', lineHeight: '1.5', wordBreak: 'break-word' }}>
          {event.message}
        </div>

        {event.hostname && (
          <div style={{ color: C.t3, fontSize: '10px', marginTop: '4px' }}>
            host: {event.hostname}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Timeline({ initialIP }) {
  const [ip, setIp]         = useState(initialIP || '');
  const [inputIp, setInput] = useState(initialIP || '');
  const [hours, setHours]   = useState(24);
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const load = useCallback((targetIp, h) => {
    if (!targetIp) return;
    setLoading(true);
    setError('');
    fetchTimeline(targetIp, h)
      .then(setData)
      .catch(() => setError('Failed to load timeline. Check IP or server connection.'))
      .finally(() => setLoading(false));
  }, []);

  // Auto-load if initialIP provided
  useEffect(() => {
    if (initialIP) {
      setIp(initialIP);
      setInput(initialIP);
      load(initialIP, hours);
    }
  }, [initialIP]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputIp.trim()) return;
    setIp(inputIp.trim());
    load(inputIp.trim(), hours);
  };

  const handleHoursChange = (h) => {
    setHours(h);
    if (ip) load(ip, h);
  };

  const alerts = data?.events?.filter(e => e.event_type === 'alert') || [];
  const logs   = data?.events?.filter(e => e.event_type === 'log')   || [];

  const inputStyle = {
    background: C.bg2, border: `1px solid ${C.b1}`,
    borderRadius: '6px', color: C.t1, fontSize: '12px',
    padding: '7px 12px', outline: 'none',
  };

  return (
    <div style={{ padding: '20px', maxWidth: '860px' }}>
      <h2 style={{ color: C.t1, margin: '0 0 16px', fontSize: '18px', fontWeight: '700' }}>
        Attack Timeline
      </h2>

      {/* IP input + hours */}
      <form onSubmit={handleSubmit} style={{
        ...card({ padding: '14px 16px', marginBottom: '20px' }),
        display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px' }}>
          <label style={{ ...sectionTitle, marginBottom: 0 }}>Source IP</label>
          <input
            value={inputIp}
            onChange={e => setInput(e.target.value)}
            placeholder="e.g. 192.168.1.30"
            style={{ ...inputStyle }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ ...sectionTitle, marginBottom: 0 }}>Lookback Window</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {HOURS_OPTIONS.map(o => (
              <button
                type="button"
                key={o.value}
                onClick={() => handleHoursChange(o.value)}
                style={{
                  background: hours === o.value ? C.blue : C.bg2,
                  color:      hours === o.value ? '#fff' : C.t2,
                  border: `1px solid ${hours === o.value ? C.blue : C.b1}`,
                  borderRadius: '6px', padding: '6px 10px', cursor: 'pointer',
                  fontSize: '11px', fontWeight: '600',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" style={{
          background: C.blue, color: '#fff', border: 'none',
          borderRadius: '6px', padding: '7px 20px', cursor: 'pointer',
          fontSize: '12px', fontWeight: '700', alignSelf: 'flex-end',
        }}>
          Load Timeline
        </button>
      </form>

      {loading && (
        <div style={{ color: C.t3, textAlign: 'center', padding: '40px' }}>Loading timeline for {ip}…</div>
      )}
      {error && (
        <div style={{ color: C.critical, padding: '16px', background: 'var(--red-bg)', borderRadius: '8px', border: '1px solid var(--red-bd)' }}>{error}</div>
      )}

      {data && !loading && (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[
              { label: 'Events', value: data.events?.length || 0, color: C.t2 },
              { label: 'Alerts', value: alerts.length, color: '#E5484D' },
              { label: 'Logs',   value: logs.length,   color: C.t3 },
              { label: 'Window', value: `${data.hours}h`, color: C.t3 },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ ...card({ padding: '10px 18px' }), textAlign: 'center' }}>
                <div style={{ color, fontSize: '20px', fontWeight: '800' }}>{value}</div>
                <div style={{ color: C.t3, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>

          {data.events?.length === 0 ? (
            <div style={{ ...card({ padding: '40px', textAlign: 'center' }), color: C.t3 }}>
              No events found for <strong style={{ color: C.t1 }}>{ip}</strong> in the last {data.hours}h.
            </div>
          ) : (
            <div>
              <div style={{ ...sectionTitle, marginBottom: '12px' }}>
                Timeline — {ip} · last {data.hours}h
              </div>
              {data.events.map((event, i) => (
                <TimelineEvent key={`${event.event_type}-${event.id}-${i}`} event={event} index={i} />
              ))}
            </div>
          )}
        </>
      )}

      {!data && !loading && (
        <div style={{ ...card({ padding: '60px', textAlign: 'center' }), color: C.t3, fontSize: '13px' }}>
          Enter an IP address above to view its attack timeline.
        </div>
      )}
    </div>
  );
}
