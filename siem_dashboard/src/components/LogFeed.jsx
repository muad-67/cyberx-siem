/**
 * LogFeed.jsx
 * Live log stream with search, severity/source filters, repeat grouping,
 * a pause that buffers (nothing is lost while you read), and expandable rows.
 *
 * On mount: fetches the last 100 logs from REST.
 * SSE:      new logs are prepended as they arrive (buffered while paused).
 * Fallback: polls REST every 5s when SSE is not connected.
 * The list is capped at 200 entries to keep the DOM lean.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { parseTs, localInputToUtc } from '../utils/time';
import { fetchLogs } from '../services/api';
import { useSSE } from '../services/useSSE';
import { C, SEV, card, MONO } from '../theme';
import { IPLink, HostLink, CardSkeleton, EmptyState } from './ui';

const MAX_LOGS = 200;
const LOG_TYPES = ['', 'auth', 'syslog', 'network', 'kernel', 'windows', 'web', 'system'];
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];

function Chip({ active, onClick, children }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} style={{
      background: active ? C.accent : C.bg1, color: active ? '#fff' : C.t2,
      border: `1px solid ${active ? C.accent : C.b1}`, borderRadius: 999, padding: '4px 12px',
      cursor: 'pointer', fontSize: 12.5, fontWeight: 500, transition: 'all .15s', textTransform: 'capitalize',
    }}>{children}</button>
  );
}

const fieldLabel = { color: C.t3, fontSize: 12, fontWeight: 500 };
const inputStyle = {
  background: C.bg2, border: `1px solid ${C.b1}`, borderRadius: 10, color: C.t1,
  fontSize: 13, padding: '8px 12px', outline: 'none', width: '100%',
};

/** Collapse consecutive identical events (same host, severity and message) into one ×N row. */
function groupRepeats(logs) {
  const out = [];
  for (const l of logs) {
    const prev = out[out.length - 1];
    if (prev && prev.message === l.message && prev.source_ip === l.source_ip && prev.severity === l.severity) {
      prev.count += 1;
    } else {
      out.push({ ...l, count: 1 });
    }
  }
  return out;
}

function LogRow({ log, open, onToggle }) {
  const s = SEV[log.severity] || SEV.info;
  let raw = null;
  if (open && log.raw_data) {
    try { raw = JSON.stringify(JSON.parse(log.raw_data), null, 2); } catch { raw = String(log.raw_data); }
  }
  return (
    <div style={{ borderBottom: `1px solid ${C.b0}` }}>
      <div role="button" tabIndex={0} aria-expanded={open} onClick={onToggle}
           onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
           style={{ display: 'grid', gridTemplateColumns: '92px 78px 128px minmax(0,1fr)', gap: 10, alignItems: 'baseline', padding: '8px 6px', cursor: 'pointer',
                    background: open ? C.bg2 : 'transparent' }}>
        <span style={{ color: C.t3 }}>{parseTs(log.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
        <span style={{ color: s.text, fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <span aria-hidden="true" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: s.badge, marginRight: 6 }} />
          {log.severity}
        </span>
        <span onClick={e => e.stopPropagation()} style={{ color: C.t2, fontSize: 12 }}><IPLink ip={log.source_ip} /></span>
        <span style={{ color: C.t1, wordBreak: 'break-word', lineHeight: 1.5 }}>
          {log.message}
          {log.count > 1 && <span title={`${log.count} identical events in a row`} style={{ marginLeft: 8, background: C.bg3, color: C.accent, borderRadius: 99, padding: '1px 8px', fontSize: 11.5, fontWeight: 600 }}>×{log.count}</span>}
        </span>
      </div>
      {open && (
        <div style={{ padding: '4px 10px 14px 106px', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', color: C.t2, fontSize: 12 }}>
            <span>Log #{log.id}</span>
            <span>Type: <b style={{ color: C.t1, fontWeight: 600 }}>{log.log_type}</b></span>
            <span>Host: <HostLink host={log.hostname || 'unknown'} style={{ color: C.t1, fontWeight: 600, fontFamily: 'inherit' }} /></span>
            {log.country && <span>Location: <b style={{ color: C.t1, fontWeight: 600 }}>{[log.city, log.country].filter(Boolean).join(', ')}</b></span>}
          </div>
          {raw && <pre style={{ margin: 0, padding: 12, background: C.bg1, border: `1px solid ${C.b1}`, borderRadius: 10, color: C.t2, fontSize: 11.5, overflowX: 'auto', maxHeight: 220 }}>{raw}</pre>}
        </div>
      )}
    </div>
  );
}

export default function LogFeed() {
  const [logs, setLogs]           = useState(null);
  const [filter, setFilter]       = useState('');
  const [sevFilter, setSevFilter] = useState('');
  const [hostFilter, setHostFilter] = useState('');
  const [group, setGroup]         = useState(true);
  const [paused, setPaused]       = useState(false);
  const [buffer, setBuffer]       = useState([]);       // logs that arrived while paused
  const [searchMode, setSearchMode] = useState(false);
  const [total, setTotal]         = useState(null);
  const [openId, setOpenId]       = useState(null);

  const [query, setQuery]         = useState('');
  const [fromDt, setFromDt]       = useState('');
  const [toDt, setToDt]           = useState('');
  const [hostname, setHostname]   = useState('');

  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const buildParams = useCallback((forSearch = false) => {
    const p = { limit: 100 };
    if (filter) p.log_type = filter;
    if (forSearch) {
      if (query)    p.q        = query;
      if (fromDt)   p.from     = localInputToUtc(fromDt);
      if (toDt)     p.to       = localInputToUtc(toDt);
      if (hostname) p.hostname = hostname;
    }
    return p;
  }, [filter, query, fromDt, toDt, hostname]);

  const handleNewLog = useCallback(log => {
    if (searchMode) return;
    if (filter && log.log_type !== filter) return;
    if (pausedRef.current) { setBuffer(b => [log, ...b].slice(0, MAX_LOGS)); return; }
    setLogs(prev => {
      const list = prev || [];
      if (list.length > 0 && list[0].id === log.id) return list;
      return [log, ...list].slice(0, MAX_LOGS);
    });
  }, [filter, searchMode]);

  const { sseOk } = useSSE({ onLog: handleNewLog });

  const loadLogs = useCallback((forSearch = false) => {
    fetchLogs(buildParams(forSearch))
      .then(data => {
        setLogs(Array.isArray(data) ? data : (data.logs || []));
        setTotal(data.total != null ? data.total : null);
      })
      .catch(() => setLogs(prev => prev || []));
  }, [buildParams]);

  useEffect(() => { loadLogs(searchMode); }, [filter, searchMode, loadLogs]);

  useEffect(() => {
    if (sseOk || paused || searchMode) return undefined;
    const id = setInterval(() => loadLogs(false), 5000);
    return () => clearInterval(id);
  }, [sseOk, paused, searchMode, loadLogs]);

  const resume = () => {
    setPaused(false);
    setLogs(prev => [...buffer, ...(prev || [])].slice(0, MAX_LOGS));
    setBuffer([]);
  };

  const handleSearch = e => { e.preventDefault(); setSearchMode(true); loadLogs(true); };
  const handleClearSearch = () => { setQuery(''); setFromDt(''); setToDt(''); setHostname(''); setSearchMode(false); };

  const hosts = useMemo(() => [...new Set((logs || []).map(l => l.hostname).filter(Boolean))].sort(), [logs]);
  const visible = useMemo(() => {
    let rows = (logs || []).filter(l => (!sevFilter || l.severity === sevFilter) && (!hostFilter || l.hostname === hostFilter));
    if (group) rows = groupRepeats(rows);
    return rows;
  }, [logs, sevFilter, hostFilter, group]);

  const live = !paused && sseOk && !searchMode;
  const status = paused ? { label: 'Paused', tone: 'org' } : searchMode ? { label: 'Search results', tone: 'ind' } : sseOk ? { label: 'Live', tone: 'grn' } : { label: 'Polling', tone: 'amb' };

  return (
    <div style={{ padding: '4px 4px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', margin: '4px 8px 16px' }}>
        <div>
          <h1 style={{ margin: 0, color: C.t1, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>Log feed</h1>
          <p style={{ margin: '6px 0 0', color: C.t2, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `var(--${status.tone}-bg)`, color: `var(--${status.tone}-fg)`,
                           border: `1px solid var(--${status.tone}-bd)`, borderRadius: 999, padding: '1px 10px', fontSize: 12.5, fontWeight: 600 }}>
              <span className={live ? 'pulse' : ''} aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
              {status.label}
            </span>
            {logs && `${visible.length} shown`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.t2, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={group} onChange={e => setGroup(e.target.checked)} /> Group repeats
          </label>
          {paused ? (
            <button type="button" onClick={resume} style={{ border: 'none', background: C.accent, color: '#fff', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Resume{buffer.length ? ` · ${buffer.length} new` : ''}
            </button>
          ) : (
            <button type="button" onClick={() => setPaused(true)} style={{ border: `1px solid ${C.b1}`, background: C.bg1, color: C.t1, borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Pause
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '0 8px 12px' }}>
        {LOG_TYPES.map(t => <Chip key={t || 'all'} active={filter === t && !searchMode} onClick={() => { setFilter(t); setSearchMode(false); }}>{t || 'All types'}</Chip>)}
        <span aria-hidden="true" style={{ width: 1, height: 20, background: C.b2, margin: '0 4px' }} />
        <Chip active={!sevFilter} onClick={() => setSevFilter('')}>Any severity</Chip>
        {SEVERITIES.map(sv => <Chip key={sv} active={sevFilter === sv} onClick={() => setSevFilter(sevFilter === sv ? '' : sv)}>{sv}</Chip>)}
        {hosts.length > 1 && (
          <>
            <span aria-hidden="true" style={{ width: 1, height: 20, background: C.b2, margin: '0 4px' }} />
            <label className="sr-only" htmlFor="host-filter">Source host</label>
            <select id="host-filter" value={hostFilter} onChange={e => setHostFilter(e.target.value)}
                    style={{ ...inputStyle, width: 'auto', borderRadius: 999, padding: '5px 12px', fontSize: 12.5 }}>
              <option value="">All sources</option>
              {hosts.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </>
        )}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} style={{ ...card({ padding: '14px 16px', marginBottom: 14 }), display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: '2 1 200px', display: 'grid', gap: 4 }}>
          <label htmlFor="lf-q" style={fieldLabel}>Keyword</label>
          <input id="lf-q" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search messages…" style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 160px', display: 'grid', gap: 4 }}>
          <label htmlFor="lf-from" style={fieldLabel}>From</label>
          <input id="lf-from" type="datetime-local" value={fromDt} onChange={e => setFromDt(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 160px', display: 'grid', gap: 4 }}>
          <label htmlFor="lf-to" style={fieldLabel}>To</label>
          <input id="lf-to" type="datetime-local" value={toDt} onChange={e => setToDt(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 140px', display: 'grid', gap: 4 }}>
          <label htmlFor="lf-host" style={fieldLabel}>Hostname</label>
          <input id="lf-host" value={hostname} onChange={e => setHostname(e.target.value)} placeholder="Any host" style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" style={{ border: 'none', background: C.accent, color: '#fff', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Search</button>
          {searchMode && <button type="button" onClick={handleClearSearch} style={{ border: `1px solid ${C.b1}`, background: C.bg1, color: C.t1, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Clear</button>}
        </div>
        {searchMode && total != null && <span style={{ color: C.t2, fontSize: 13 }}>{total} result{total !== 1 ? 's' : ''}</span>}
      </form>

      {/* Stream */}
      <section aria-label="Log entries" style={{ ...card({ padding: '6px 10px' }), fontFamily: MONO, fontSize: 12.5, maxHeight: 'calc(100vh - 360px)', minHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {logs === null ? (
          <div style={{ padding: 16 }}><CardSkeleton lines={7} height={280} /></div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
            title={searchMode ? 'No logs match your search' : logs.length ? 'No logs match these filters' : 'Waiting for logs'}
            body={searchMode ? 'Try a broader keyword or a wider date range.' : logs.length ? 'Clear a filter to see more.' : 'Start the Mac agent (./run_mac.sh does this for you) or send test attacks with the simulator.'} />
        ) : visible.map(l => (
          <LogRow key={l.id} log={l} open={openId === l.id} onToggle={() => setOpenId(openId === l.id ? null : l.id)} />
        ))}
      </section>
      <div style={{ color: C.t3, fontSize: 12, margin: '8px 8px 0' }}>Newest first · capped at {MAX_LOGS} · click a row for the raw event</div>
    </div>
  );
}
