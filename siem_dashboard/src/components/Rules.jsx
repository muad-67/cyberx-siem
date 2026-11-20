/**
 * Rules.jsx — detection rule management.
 * Turn rules on/off, tune thresholds and windows, and dry-run a rule against recent logs.
 * Editing needs an admin account; analysts get a read-only view.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { fetchRules, updateRule, testRule } from '../services/api';
import { C, SEV, SHADOW } from '../theme';
import { CardSkeleton, EmptyState } from './ui';

const pretty = s => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const fmtWindow = s => (s % 3600 === 0 ? `${s / 3600}h` : s % 60 === 0 ? `${s / 60}m` : `${s}s`);

function Toggle({ on, onChange, disabled, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
            style={{ width: 40, height: 24, borderRadius: 99, border: 'none', padding: 2, cursor: disabled ? 'not-allowed' : 'pointer',
                     background: on ? C.accent : C.b2, opacity: disabled ? 0.6 : 1, transition: 'background .15s', display: 'flex', alignItems: 'center' }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 16 : 0}px)`, transition: 'transform .15s', boxShadow: '0 1px 2px rgba(0,0,0,.3)' }} />
    </button>
  );
}

const numInput = {
  width: 72, padding: '6px 8px', borderRadius: 8, border: `1px solid ${C.b1}`, background: C.bg2,
  color: C.t1, fontSize: 13, textAlign: 'right',
};

function RuleRow({ rule, isAdmin, onSaved }) {
  const [enabled, setEnabled] = useState(rule.enabled);
  const [threshold, setThreshold] = useState(rule.threshold);
  const [windowSec, setWindowSec] = useState(rule.window);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [test, setTest] = useState(null);
  const dirty = enabled !== rule.enabled || Number(threshold) !== rule.threshold || Number(windowSec) !== rule.window;
  const s = SEV[rule.severity] || SEV.info;

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await updateRule(rule.id, { enabled, threshold: Number(threshold), window: Number(windowSec) });
      setMsg({ ok: true, text: 'Saved' }); onSaved();
    } catch (e) {
      setMsg({ ok: false, text: e?.response?.data?.error || 'Could not save' });
    } finally { setBusy(false); }
  };

  const runTest = async () => {
    setBusy(true); setTest(null);
    try { setTest(await testRule(rule.id, { hours: 24, threshold: Number(threshold) })); }
    catch { setTest({ error: true }); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ padding: '16px 0', borderBottom: `1px solid ${C.b0}`, opacity: enabled ? 1 : 0.65 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Toggle on={enabled} onChange={setEnabled} disabled={!isAdmin} label={`${rule.name} enabled`} />
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: C.t1, fontWeight: 600, fontSize: 14 }}>{rule.name}</span>
            <span style={{ color: C.t3, fontSize: 12 }}>{rule.id}</span>
            <span style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}`, borderRadius: 99, padding: '1px 9px', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{rule.severity}</span>
          </div>
          <div style={{ color: C.t2, fontSize: 12.5, marginTop: 3 }}>
            {pretty(rule.alert_type)} · looks at <b style={{ fontWeight: 600 }}>{rule.log_type}</b> logs · {rule.hits_24h} alert{rule.hits_24h === 1 ? '' : 's'} in the last 24h
          </div>
        </div>

        <label style={{ color: C.t2, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          Fire after
          <input type="number" min="1" aria-label={`${rule.name} threshold`} value={threshold} disabled={!isAdmin}
                 onChange={e => setThreshold(e.target.value)} style={numInput} />
          events
        </label>
        <label style={{ color: C.t2, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          within
          <input type="number" min="1" aria-label={`${rule.name} window in seconds`} value={windowSec} disabled={!isAdmin}
                 onChange={e => setWindowSec(e.target.value)} style={numInput} />
          s <span style={{ color: C.t3 }}>({fmtWindow(Number(windowSec) || 0)})</span>
        </label>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={runTest} disabled={busy}
                  style={{ border: `1px solid ${C.b1}`, background: C.bg1, color: C.t1, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Test
          </button>
          {isAdmin && (
            <button type="button" onClick={save} disabled={busy || !dirty}
                    style={{ border: 'none', background: dirty ? C.accent : C.b1, color: dirty ? '#fff' : C.t3, borderRadius: 10, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: dirty ? 'pointer' : 'default' }}>
              Save
            </button>
          )}
        </div>
      </div>

      {(msg || test) && (
        <div role="status" style={{ marginTop: 10, marginLeft: 54, fontSize: 13, color: C.t2 }}>
          {msg && <span style={{ color: msg.ok ? 'var(--grn-fg)' : 'var(--red-fg)', fontWeight: 600, marginRight: 12 }}>{msg.text}</span>}
          {test && !test.error && (
            <span>
              Last {test.hours}h: <b style={{ color: C.t1 }}>{test.matching_events}</b> matching event{test.matching_events === 1 ? '' : 's'} from {test.sources_matching} source{test.sources_matching === 1 ? '' : 's'};
              {' '}<b style={{ color: C.t1 }}>{test.sources_that_would_alert}</b> would have triggered an alert at a threshold of {test.threshold}.
            </span>
          )}
          {test?.error && <span style={{ color: 'var(--red-fg)' }}>Test failed.</span>}
        </div>
      )}
    </div>
  );
}

export default function Rules({ user }) {
  const [rules, setRules] = useState(null);
  const [error, setError] = useState(false);
  const isAdmin = user?.role === 'admin';

  const load = useCallback(() => {
    fetchRules().then(setRules).catch(() => setError(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: '4px 4px 24px' }}>
      <div style={{ margin: '4px 8px 18px' }}>
        <h1 style={{ margin: 0, color: C.t1, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>Detection rules</h1>
        <p style={{ margin: '6px 0 0', color: C.t2, fontSize: 14 }}>
          {isAdmin ? 'Tune how sensitive each rule is. Changes apply to the next log that arrives.'
                   : 'You can see and test every rule. Editing needs an admin account.'}
        </p>
      </div>
      <section style={{ background: C.bg1, borderRadius: 20, boxShadow: SHADOW, padding: '6px 22px' }}>
        {error ? <EmptyState title="Couldn’t load the rules" body="Check that the server is running, then refresh." />
          : !rules ? <div style={{ padding: 16 }}><CardSkeleton lines={5} height={260} /></div>
          : rules.map(r => <RuleRow key={r.id} rule={r} isAdmin={isAdmin} onSaved={load} />)}
      </section>
    </div>
  );
}
