/**
 * services/useSSE.js
 * React hook that opens a Server-Sent Events connection to the SIEM backend.
 *
 * The browser reconnects automatically (built into EventSource).
 * Callbacks are kept in refs so they can be updated without restarting the stream.
 *
 * Usage:
 *   const { sseOk } = useSSE({
 *     onLog:   (log)   => setLogs(prev => [log, ...prev].slice(0, 200)),
 *     onAlert: (alert) => setAlerts(prev => [alert, ...prev]),
 *     onStats: (stats) => setStats(stats),
 *   });
 */

import { useEffect, useRef, useState } from 'react';

const BASE_URL = process.env.REACT_APP_SIEM_URL || 'http://127.0.0.1:5000';

export function useSSE({ onLog, onAlert, onStats } = {}) {
  const [sseOk, setSseOk] = useState(false);

  // Keep latest callbacks in refs — avoids restarting EventSource on every render
  const onLogRef   = useRef(onLog);
  const onAlertRef = useRef(onAlert);
  const onStatsRef = useRef(onStats);
  useEffect(() => { onLogRef.current   = onLog;   }, [onLog]);
  useEffect(() => { onAlertRef.current = onAlert; }, [onAlert]);
  useEffect(() => { onStatsRef.current = onStats; }, [onStats]);

  useEffect(() => {
    const es = new EventSource(`${BASE_URL}/api/stream`);

    es.addEventListener('log', e => {
      try { onLogRef.current?.(JSON.parse(e.data)); } catch {}
    });

    es.addEventListener('alert', e => {
      try { onAlertRef.current?.(JSON.parse(e.data)); } catch {}
    });

    es.addEventListener('stats', e => {
      try { onStatsRef.current?.(JSON.parse(e.data)); } catch {}
    });

    // heartbeat comment keeps the connection alive and signals we're connected
    es.onmessage = () => setSseOk(true);
    es.onopen    = () => setSseOk(true);
    es.onerror   = () => setSseOk(false);

    return () => { es.close(); setSseOk(false); };
  }, []); // open once, never re-open

  return { sseOk };
}
