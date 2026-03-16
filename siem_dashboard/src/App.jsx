/**
 * App.jsx — CyberX SIEM shell
 * Sidebar navigation + sticky topbar + scrollable content area.
 * Includes JWT authentication guard and Reports tab.
 */

import React, { useState, useEffect } from 'react';
import { C } from './theme';
import Overview       from './components/Overview';
import AlertPanel     from './components/AlertPanel';
import LogFeed        from './components/LogFeed';
import StatsChart     from './components/StatsChart';
import MitreMap       from './components/MitreMap';
import ResponsePanel  from './components/ResponsePanel';
import Reports        from './components/Reports';
import Endpoints      from './components/Endpoints';
import Timeline       from './components/Timeline';
import Investigation  from './components/Investigation';
import Login          from './pages/Login';
import { useSSE }     from './services/useSSE';

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'overview',       label: 'Overview',      icon: SVGOverview       },
  { id: 'alerts',         label: 'Alerts',        icon: SVGAlerts         },
  { id: 'logs',           label: 'Log Feed',      icon: SVGLogs           },
  { id: 'stats',          label: 'Analytics',     icon: SVGStats          },
  { id: 'mitre',          label: 'MITRE ATT&CK',  icon: SVGMitre          },
  { id: 'response',       label: 'Response',      icon: SVGResponse       },
  { id: 'reports',        label: 'Reports',       icon: SVGReports        },
  { id: 'endpoints',      label: 'Endpoints',     icon: SVGEndpoints      },
  { id: 'timeline',       label: 'Timeline',      icon: SVGTimeline       },
  { id: 'investigation',  label: 'Investigations',icon: SVGInvestigation  },
];

// ── Inline SVG icons ──────────────────────────────────────────────────────────
function SVGOverview({ color }) {
  return <svg width="16" height="16" fill="none" stroke={color} strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}
function SVGAlerts({ color }) {
  return <svg width="16" height="16" fill="none" stroke={color} strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>;
}
function SVGLogs({ color }) {
  return <svg width="16" height="16" fill="none" stroke={color} strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>;
}
function SVGStats({ color }) {
  return <svg width="16" height="16" fill="none" stroke={color} strokeWidth="1.5" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}
function SVGMitre({ color }) {
  return <svg width="16" height="16" fill="none" stroke={color} strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function SVGResponse({ color }) {
  return <svg width="16" height="16" fill="none" stroke={color} strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>;
}
function SVGReports({ color }) {
  return <svg width="16" height="16" fill="none" stroke={color} strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
}
function SVGEndpoints({ color }) {
  return <svg width="16" height="16" fill="none" stroke={color} strokeWidth="1.5" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>;
}
function SVGTimeline({ color }) {
  return <svg width="16" height="16" fill="none" stroke={color} strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M3 12h6m6 0h6"/><path d="M12 3v6m0 6v6"/></svg>;
}
function SVGInvestigation({ color }) {
  return <svg width="16" height="16" fill="none" stroke={color} strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}

// ── Sidebar nav item ───────────────────────────────────────────────────────────
function NavItem({ item, active, onClick }) {
  const Icon = item.icon;
  const isActive = active === item.id;
  return (
    <button
      onClick={() => onClick(item.id)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 14px', borderRadius: '8px', marginBottom: '1px',
        background: isActive
          ? 'linear-gradient(90deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.04) 100%)'
          : 'transparent',
        border: isActive ? `1px solid rgba(59,130,246,0.22)` : '1px solid transparent',
        color: isActive ? C.blueLt : C.t2,
        cursor: 'pointer', textAlign: 'left',
        fontSize: '13px', fontWeight: isActive ? '600' : '400',
        transition: 'all 0.15s ease',
        letterSpacing: '-0.01em',
      }}
    >
      <Icon color={isActive ? C.blueLt : C.t3} />
      {item.label}
      {item.id === 'alerts' && isActive && (
        <span style={{ marginLeft: 'auto', background: '#ef444425', color: '#ef4444', border: '1px solid #ef444440', borderRadius: '99px', fontSize: '9px', padding: '1px 7px', fontWeight: '700' }}>
          LIVE
        </span>
      )}
    </button>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]         = useState('overview');
  const [timelineIP, setTimelineIP] = useState('');
  const [time, setTime]         = useState(new Date());
  const [user, setUser]         = useState(() => {
    try { return JSON.parse(localStorage.getItem('cyberx_user') || 'null'); }
    catch { return null; }
  });
  const { sseOk } = useSSE({});

  const navigateToTimeline = (ip) => {
    setTimelineIP(ip);
    setPage('timeline');
  };

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const handleLogin = (userData) => setUser(userData);

  const handleLogout = () => {
    localStorage.removeItem('cyberx_token');
    localStorage.removeItem('cyberx_user');
    setUser(null);
  };

  // Show login if not authenticated
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const active = NAV.find(n => n.id === page);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg0 }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside style={{
        width: '224px', flexShrink: 0,
        background: `linear-gradient(180deg, #0c1428 0%, ${C.bg0} 100%)`,
        borderRight: `1px solid ${C.b0}`,
        display: 'flex', flexDirection: 'column',
        position: 'relative', zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${C.b0}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px', height: '34px', flexShrink: 0,
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(59,130,246,0.35)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <div style={{ color: C.t1, fontWeight: '700', fontSize: '15px', letterSpacing: '-0.4px' }}>CyberX</div>
              <div style={{ color: C.t3, fontSize: '9.5px', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '1px' }}>SIEM Platform</div>
            </div>
          </div>
        </div>

        {/* Nav group */}
        <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
          <div style={{ color: C.t3, fontSize: '9px', fontWeight: '700', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '0 6px 10px' }}>
            Menu
          </div>
          {NAV.map(item => (
            <NavItem key={item.id} item={item} active={page} onClick={setPage} />
          ))}
        </nav>

        {/* User info + logout */}
        <div style={{ padding: '12px 14px 16px', borderTop: `1px solid ${C.b0}` }}>
          {/* SSE status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
            <span className={sseOk ? 'pulse' : ''} style={{
              width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
              background: sseOk ? '#10b981' : '#475569',
              boxShadow: sseOk ? '0 0 8px #10b98160' : 'none',
            }} />
            <span style={{ color: sseOk ? '#10b981' : C.t3, fontSize: '11px', fontWeight: '600' }}>
              {sseOk ? 'Stream Connected' : 'Connecting…'}
            </span>
          </div>
          {/* User row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '11px', fontWeight: '700',
            }}>
              {user.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: C.t1, fontSize: '12px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.username}
              </div>
              <div style={{ color: C.t3, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {user.role}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '6px', borderRadius: '6px',
            border: `1px solid ${C.b1}`, background: 'transparent',
            color: C.t3, fontSize: '11px', cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <header style={{
          height: '54px', flexShrink: 0,
          background: C.bg1,
          borderBottom: `1px solid ${C.b0}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: C.t3, fontSize: '13px' }}>CyberX</span>
            <span style={{ color: C.b2, fontSize: '13px' }}>/</span>
            <span style={{ color: C.t1, fontSize: '13px', fontWeight: '600' }}>{active?.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span style={{ color: C.t3, fontSize: '12px' }}>
              {time.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: sseOk ? '#10b98110' : '#47556910',
              border: `1px solid ${sseOk ? '#10b98130' : '#47556930'}`,
              borderRadius: '99px', padding: '4px 10px',
            }}>
              <span className={sseOk ? 'pulse' : ''} style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: sseOk ? '#10b981' : '#475569',
              }} />
              <span style={{ color: sseOk ? '#10b981' : C.t3, fontSize: '11px', fontWeight: '600' }}>
                {sseOk ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', background: C.bg0 }}>
          {page === 'overview'      && <Overview  onNavigate={setPage} />}
          {page === 'alerts'        && <AlertPanel onTimeline={navigateToTimeline} />}
          {page === 'logs'          && <LogFeed />}
          {page === 'stats'         && <StatsChart />}
          {page === 'mitre'         && <MitreMap />}
          {page === 'response'      && <ResponsePanel />}
          {page === 'reports'       && <Reports />}
          {page === 'endpoints'     && <Endpoints />}
          {page === 'timeline'      && <Timeline initialIP={timelineIP} />}
          {page === 'investigation' && <Investigation />}
        </main>
      </div>
    </div>
  );
}
