/**
 * LogFeed.jsx
 * Live scrolling log stream with advanced search.
 *
 * On mount: fetches last 100 logs from REST (immediate history).
 * SSE:      new logs prepended instantly as they arrive.
 * Fallback: polls REST every 5s when SSE is not connected.
 * Buffer is capped at 200 entries to keep DOM lean.
 * Advanced search: keyword, date-from, date-to, hostname, log_type, severity.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchLogs } from '../services/api';
import { useSSE } from '../services/useSSE';
import { C, card, pill } from '../theme';

const MAX_LOGS = 200;

const SEV_COLOR = {
  critical: C.critical,
  high:     C.high,
  medium:   C.medium,
  low:      C.low,
  info:     C.info,
};

function FilterPill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? C.blue : C.bg2,
      color:      active ? '#fff' : C.t2,
      border: `1px solid ${active ? C.blue : C.b1}`,
      padding: '3px 11px',
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

const LOG_TYPES = ['', 'auth', 'syslog', 'network', 'kernel', 'windows', 'web', 'system'];

export default function LogFeed() {
  const [logs, setLogs]           = useState([]);
  const [filter, setFilter]       = useState('');
  const [paused, setPaused]       = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [total, setTotal]         = useState(null);

  // Advanced search state
  const [query, setQuery]         = useState('');
  const [fromDt, setFromDt]       = useState('');
  const [toDt, setToDt]           = useState('');
  const [hostname, setHostname]   = useState('');

  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Build params object for API calls
  const buildParams = useCallback((forSearch = false) => {
    const p = { limit: 100 };
    if (filter) p.log_type = filter;
    if (forSearch) {
      if (query)    p.q        = query;
      if (fromDt)   p.from     = fromDt;
      if (toDt)     p.to       = toDt;
      if (hostname) p.hostname = hostname;
    }
    return p;
  }, [filter, query, fromDt, toDt, hostname]);

  // SSE: push new log to top (only when not in search mode)
  const handleNewLog = useCallback(log => {
    if (pausedRef.current || searchMode) return;
    if (filter && log.log_type !== filter) return;
    setLogs(prev => {
      if (prev.length > 0 && prev[0].id === log.id) return prev;
      return [log, ...prev].slice(0, MAX_LOGS);
    });
  }, [filter, searchMode]);

  const { sseOk } = useSSE({ onLog: handleNewLog });

  // Load logs (REST)
  const loadLogs = useCallback((forSearch = false) => {
    fetchLogs(buildParams(forSearch))
      .then(data => {
        const rows = Array.isArray(data) ? data : (data.logs || []);
        setLogs(rows);
        if (data.total != null) setTotal(data.total);
        else setTotal(null);
      })
      .catch(() => {});
  }, [buildParams]);

  // Initial load + reload on filter change
  useEffect(() => {
    loadLogs(searchMode);
  }, [filter, searchMode, loadLogs]);

  // Fallback poll
  useEffect(() => {
    if (sseOk || paused || searchMode) return;
    const id = setInterval(() => loadLogs(false), 5000);
    return () => clearInterval(id);
  }, [sseOk, paused, searchMode, loadLogs]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchMode(true);
    loadLogs(true);
  };

  const handleClearSearch = () => {
    setQuery('');
    setFromDt('');
    setToDt('');
    setHostname('');
    setSearchMode(false);
  };

  const statusColor = paused ? C.critical : sseOk ? C.success : C.high;
  const statusBg    = paused ? '#0f0505'  : sseOk ? '#052e16' : '#1c0900';
  const statusBdr   = paused ? '#7f1d1d'  : sseOk ? '#14532d' : '#7c2d12';
  const statusLabel = paused ? 'PAUSED'   : searchMode ? 'SEARCH' : sseOk ? 'SSE LIVE' : 'POLLING';

  const inputStyle = {
    background: C.bg2, border: `1px solid ${C.b1}`,
    borderRadius: '6px', color: C.t1, fontSize: '11px',
    padding: '5px 10px', outline: 'none',
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ color: C.t1, margin: 0, fontSize: '18px', fontWeight: '700' }}>
            Live Log Feed
          </h2>
          <span style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: statusBg, color: statusColor,
            border: `1px solid ${statusBdr}`,
            borderRadius: '20px', fontSize: '10px', padding: '2px 8px', fontWeight: '700',
          }}>
            <span className={!paused && sseOk && !searchMode ? 'pulse' : ''} style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: statusColor, display: 'inline-block',
            }} />
            {statusLabel}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {LOG_TYPES.map(t => (
            <FilterPill key={t} label={t || 'All'} active={filter === t && !searchMode} onClick={() => { setFilter(t); setSearchMode(false); }} />
          ))}
          <button onClick={() => setPaused(p => !p)} style={{
            background: paused ? '#450a0a' : C.bg2,
            color:      paused ? '#fca5a5' : C.t2,
            border: `1px solid ${paused ? '#7f1d1d' : C.b1}`,
            padding: '3px 11px', borderRadius: '20px',
            cursor: 'pointer', fontSize: '11px', fontWeight: '600', marginLeft: '4px',
          }}>
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} style={{
        ...card({ padding: '12px 14px', marginBottom: '12px' }),
        display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '2 1 180px' }}>
          <label style={{ color: C.t3, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Keyword</label>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search messages…"
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 130px' }}>
          <label style={{ color: C.t3, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>From</label>
          <input type="datetime-local" value={fromDt} onChange={e => setFromDt(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 130px' }}>
          <label style={{ color: C.t3, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>To</label>
          <input type="datetime-local" value={toDt} onChange={e => setToDt(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 120px' }}>
          <label style={{ color: C.t3, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Hostname</label>
          <input value={hostname} onChange={e => setHostname(e.target.value)} placeholder="Filter host…" style={{ ...inputStyle }} />
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
          <button type="submit" style={{
            background: C.blue, color: '#fff', border: 'none',
            borderRadius: '6px', padding: '6px 16px', cursor: 'pointer',
            fontSize: '11px', fontWeight: '700',
          }}>Search</button>
          {searchMode && (
            <button type="button" onClick={handleClearSearch} style={{
              background: C.bg2, color: C.t2, border: `1px solid ${C.b1}`,
              borderRadius: '6px', padding: '6px 12px', cursor: 'pointer',
              fontSize: '11px', fontWeight: '600',
            }}>Clear</button>
          )}
        </div>
        {searchMode && total != null && (
          <span style={{ color: C.t3, fontSize: '11px', alignSelf: 'flex-end', marginLeft: '4px' }}>
            {total} result{total !== 1 ? 's' : ''} found
          </span>
        )}
      </form>

      {/* Log terminal pane */}
      <div style={{
        ...card({
          height: '460px',
          overflowY: 'auto',
          background: '#020810',
          fontFamily: '"Cascadia Code", "Fira Code", "Courier New", monospace',
          fontSize: '11px',
          padding: '12px',
          border: `1px solid ${C.b0}`,
        }),
      }}>
        {logs.length === 0 && (
          <div style={{ color: C.t3, padding: '24px', textAlign: 'center' }}>
            {searchMode ? 'No matching logs.' : 'Waiting for logs…'}
          </div>
        )}

        {logs.map(log => {
          const sevColor = SEV_COLOR[log.severity] || C.t3;
          return (
            <div key={log.id} style={{
              display: 'grid',
              gridTemplateColumns: '150px 68px 130px 90px 1fr',
              gap: '8px',
              padding: '4px 0',
              borderBottom: `1px solid ${C.b0}`,
              alignItems: 'baseline',
            }}>
              <span style={{ color: C.t3 }}>
                {new Date(log.created_at).toLocaleTimeString()}
              </span>
              <span style={{
                color: sevColor, textTransform: 'uppercase',
                fontSize: '9px', fontWeight: '700', letterSpacing: '0.05em',
              }}>
                {log.severity}
              </span>
              <span style={{ color: C.t3, fontSize: '10px' }}>{log.source_ip}</span>
              <span style={{ color: C.t3, fontSize: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={log.country ? `${log.city}, ${log.isp}` : ''}>
                {log.country || '—'}
              </span>
              <span style={{ color: C.t2, wordBreak: 'break-all', lineHeight: '1.5' }}>
                {log.message}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
        <span style={{ color: C.t3, fontSize: '11px' }}>
          {logs.length} entries (newest first · capped at {MAX_LOGS})
        </span>
        {paused && (
          <span style={{ color: C.critical, fontSize: '11px', fontWeight: '600' }}>
            Stream paused — new logs are not being displayed
          </span>
        )}
      </div>
    </div>
  );
}
