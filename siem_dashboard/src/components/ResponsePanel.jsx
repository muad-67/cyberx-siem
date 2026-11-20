/**
 * ResponsePanel.jsx
 * Incident Response panel — blocked IPs, watchlist, and whitelist management.
 */

import React, { useState, useEffect } from 'react';
import { parseTs } from "../utils/time";
import {
  fetchBlockedIPs, blockIP,
  fetchWatchlist, addToWatchlist, removeFromWatchlist,
  fetchWhitelist, addToWhitelist, removeFromWhitelist,
} from '../services/api';
import { C, card, sectionTitle } from '../theme';

function InputField({ value, onChange, placeholder, style }) {
  const [focus, setFocus] = useState(false);
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        background: C.bg0,
        border: `1px solid ${focus ? C.blue : C.b2}`,
        color: C.t1,
        padding: '8px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        outline: 'none',
        transition: 'border-color 0.15s',
        ...style,
      }}
    />
  );
}

function IPListSection({ title, color, items, onAdd, onRemove, placeholder, loading }) {
  const [ip, setIp]       = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg]     = useState(null);

  const handleAdd = async () => {
    if (!ip.trim()) return;
    try {
      await onAdd(ip.trim(), reason || undefined);
      setMsg({ ok: true, text: `${ip.trim()} added.` });
      setIp('');
      setReason('');
    } catch {
      setMsg({ ok: false, text: 'Failed — IP may already exist.' });
    }
    setTimeout(() => setMsg(null), 3500);
  };

  return (
    <div style={{ ...card(), padding: '20px' }}>
      <div style={{ ...sectionTitle, marginBottom: '14px' }}>{title}</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <InputField
          value={ip}
          onChange={e => setIp(e.target.value)}
          placeholder={placeholder || 'IP address'}
          style={{ flex: '1', minWidth: '150px' }}
        />
        <InputField
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason (optional)"
          style={{ flex: '1', minWidth: '150px' }}
        />
        <button
          onClick={handleAdd}
          disabled={!ip.trim()}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: `1px solid ${color}40`,
            background: `${color}15`, color,
            cursor: ip.trim() ? 'pointer' : 'not-allowed',
            fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap',
            opacity: ip.trim() ? 1 : 0.5,
          }}
        >
          Add
        </button>
      </div>
      {msg && (
        <div style={{
          marginBottom: '10px', padding: '7px 12px', borderRadius: '6px',
          background: msg.ok ? 'var(--grn-bg)' : 'var(--red-bg)',
          border: `1px solid ${msg.ok ? 'var(--grn-bd)' : 'var(--red-bd)'}`,
          color: msg.ok ? C.success : C.critical, fontSize: '12px', fontWeight: '600',
        }}>
          {msg.ok ? '✓ ' : '✗ '}{msg.text}
        </div>
      )}
      {items.length === 0 ? (
        <div style={{ color: C.t3, fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
          No entries yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {items.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 10px', borderRadius: '6px', background: C.bg0,
              border: `1px solid ${C.b0}`,
            }}>
              <span style={{ color, fontFamily: 'monospace', fontSize: '12px', fontWeight: '700', flex: 1 }}>
                {item.ip_address}
              </span>
              <span style={{ color: C.t3, fontSize: '11px', flex: 2 }}>
                {item.reason || 'No reason'}
              </span>
              <span style={{ color: C.t3, fontSize: '10px', whiteSpace: 'nowrap' }}>
                {parseTs(item.created_at).toLocaleDateString()}
              </span>
              <button
                onClick={() => onRemove(item.ip_address)}
                style={{
                  background: 'transparent', border: `1px solid ${C.b1}`,
                  color: C.t3, padding: '3px 8px', borderRadius: '4px',
                  cursor: 'pointer', fontSize: '10px',
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ResponsePanel() {
  const [blocked,   setBlocked]   = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [ipInput,   setIpInput]   = useState('');
  const [reason,    setReason]    = useState('');
  const [msg,       setMsg]       = useState(null);
  const [loading,   setLoading]   = useState(false);

  const loadAll = () => {
    fetchBlockedIPs().then(setBlocked).catch(() => {});
    fetchWatchlist().then(setWatchlist).catch(() => {});
    fetchWhitelist().then(setWhitelist).catch(() => {});
  };

  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 15000);
    return () => clearInterval(id);
  }, []);

  const handleBlock = async () => {
    if (!ipInput.trim()) return;
    setLoading(true);
    try {
      await blockIP(ipInput.trim(), reason || 'Manual block', null);
      setMsg({ ok: true, text: `${ipInput.trim()} added to blocklist.` });
      setIpInput('');
      setReason('');
      loadAll();
    } catch {
      setMsg({ ok: false, text: 'Failed — IP may already be blocked.' });
    }
    setLoading(false);
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ color: C.t1, fontSize: '18px', fontWeight: '700', letterSpacing: '-0.4px', marginBottom: '4px' }}>
        Threat Response
      </div>

      {/* Block IP */}
      <div style={{ ...card(), padding: '20px' }}>
        <div style={sectionTitle}>Simulated IP Block</div>
        <p style={{ color: C.t3, fontSize: '12px', margin: '0 0 14px', lineHeight: '1.5' }}>
          In production this would call a firewall API (pfSense / iptables / AWS Security Groups).
          Actions are recorded in the database for audit purposes.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <InputField
            value={ipInput}
            onChange={e => setIpInput(e.target.value)}
            placeholder="IP address e.g. 192.168.1.30"
            style={{ flex: '1', minWidth: '180px' }}
          />
          <InputField
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason (optional)"
            style={{ flex: '1', minWidth: '180px' }}
          />
          <button
            onClick={handleBlock}
            disabled={loading || !ipInput.trim()}
            style={{
              background: (loading || !ipInput.trim()) ? C.bg3 : 'var(--red-bg)',
              color: (loading || !ipInput.trim()) ? C.t3 : 'var(--red-fg)',
              border: `1px solid ${(loading || !ipInput.trim()) ? C.b1 : 'var(--red-bd)'}`,
              padding: '8px 20px', borderRadius: '8px',
              cursor: (loading || !ipInput.trim()) ? 'not-allowed' : 'pointer',
              fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Blocking…' : 'Block IP'}
          </button>
        </div>
        {msg && (
          <div style={{
            marginTop: '10px', padding: '8px 12px', borderRadius: '6px',
            color: msg.ok ? C.success : C.critical,
            background: msg.ok ? 'var(--grn-bg)' : 'var(--red-bg)',
            border: `1px solid ${msg.ok ? 'var(--grn-bd)' : 'var(--red-bd)'}`,
            fontSize: '12px', fontWeight: '600',
          }}>
            {msg.ok ? '✓ ' : '✗ '}{msg.text}
          </div>
        )}

        {/* Blocked IPs table */}
        {blocked.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ ...sectionTitle, marginBottom: 0 }}>Blocked IPs</span>
              <span style={{ background: 'var(--red-bg)', color: 'var(--red-fg)', border: '1px solid var(--red-bd)', borderRadius: '20px', fontSize: '10px', padding: '1px 8px', fontWeight: '700' }}>
                {blocked.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {blocked.map((b, i) => (
                <div key={b.id} style={{
                  display: 'grid', gridTemplateColumns: '140px 1fr 160px',
                  gap: '12px', padding: '8px', borderRadius: '6px',
                  background: i % 2 === 0 ? 'transparent' : C.bg0,
                  borderTop: `1px solid ${C.b0}`,
                }}>
                  <span style={{ color: 'var(--red-fg)', fontFamily: 'monospace', fontSize: '12px', fontWeight: '700' }}>
                    {b.ip_address}
                  </span>
                  <span style={{ color: C.t2, fontSize: '12px' }}>
                    {b.reason || 'No reason given'}
                    {b.alert_id && <span style={{ color: C.t3, marginLeft: '6px' }}>· Alert #{b.alert_id}</span>}
                  </span>
                  <span style={{ color: C.t3, fontSize: '11px' }}>
                    {parseTs(b.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Two-column watchlist + whitelist */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <IPListSection
          title="Watchlist — Heightened Monitoring"
          color={C.medium}
          items={watchlist}
          onAdd={async (ip, reason) => { await addToWatchlist(ip, reason); loadAll(); }}
          onRemove={async (ip) => { await removeFromWatchlist(ip); loadAll(); }}
          placeholder="IP to watch"
        />
        <IPListSection
          title="Whitelist — Trusted IPs (No Alerts)"
          color={C.success}
          items={whitelist}
          onAdd={async (ip, reason) => { await addToWhitelist(ip, reason); loadAll(); }}
          onRemove={async (ip) => { await removeFromWhitelist(ip); loadAll(); }}
          placeholder="Trusted IP"
        />
      </div>
    </div>
  );
}
