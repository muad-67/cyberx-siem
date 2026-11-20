/**
 * pages/Login.jsx — CyberX SIEM Login Page
 * Handles both login and first-time registration (when no users exist).
 */

import React, { useState } from 'react';
import { login, register } from '../services/api';
import { C, SHADOW } from '../theme';

export default function Login({ onLogin }) {
  const [mode, setMode]         = useState('login');  // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState('analyst');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let data;
      if (mode === 'login') {
        data = await login(username, password);
      } else {
        data = await register(username, email, password, role);
      }
      localStorage.setItem('cyberx_token', data.token);
      localStorage.setItem('cyberx_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(err?.response?.data?.error || 'Request failed. Check server connection.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '12px',
    background: C.bg2, border: `1px solid ${C.b1}`,
    color: C.t1, fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = {
    display: 'block', color: C.t2, fontSize: '12px',
    fontWeight: '600', marginBottom: '6px',
  };

  return (
    <div style={{
      minHeight: '100vh', background: C.bg0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '380px', background: C.bg1,
        border: `1px solid ${C.b1}`, borderRadius: '24px',
        boxShadow: SHADOW, padding: '40px 36px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '52px', height: '52px', margin: '0 auto 14px',
            background: C.accent,
            borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <div style={{ color: C.t1, fontWeight: '700', fontSize: '20px', letterSpacing: '-0.5px' }}>
            CyberX SIEM
          </div>
          <div style={{ color: C.t3, fontSize: '12px', marginTop: '4px' }}>
            {mode === 'login' ? 'Sign in to your SOC account' : 'Create a new SOC account'}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              style={inputStyle}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="analyst@company.com"
                required
                style={inputStyle}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={inputStyle}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label style={labelStyle}>Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="analyst">Analyst</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}

          {error && (
            <div style={{
              background: 'var(--red-bg)', border: '1px solid var(--red-bd)',
              borderRadius: '8px', padding: '10px 14px',
              color: 'var(--red-fg)', fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '11px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: loading
                ? 'var(--ind-bd)'
                : 'linear-gradient(90deg, #6A5BF5 0%, #6A5BF5 100%)',
              color: '#fff', fontWeight: '600', fontSize: '14px',
              marginTop: '4px', transition: 'opacity 0.15s',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Please wait…' : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {/* Toggle mode */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <span style={{ color: C.t3, fontSize: '13px' }}>
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.blueLt, fontSize: '13px', fontWeight: '600', padding: 0,
            }}
          >
            {mode === 'login' ? 'Register' : 'Sign In'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '28px', paddingTop: '20px', borderTop: `1px solid ${C.b0}` }}>
          <span style={{ color: C.t3, fontSize: '11px' }}>
            CyberX Lightweight SIEM — SOC Platform
          </span>
        </div>
      </div>
    </div>
  );
}
