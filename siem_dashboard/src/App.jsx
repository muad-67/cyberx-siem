/**
 * App.jsx — CyberX SIEM shell
 * Sidebar navigation + sticky topbar + scrollable content area.
 * Includes JWT authentication guard and Reports tab.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { C, SHADOW, SHADOW_SM, FONT, applyTheme, initialTheme } from './theme';
import { NavContext } from './context/nav';
import GlobalSearch from './components/GlobalSearch';
import { Bell, Toasts, useNotifications } from './components/Notifications';
import Rules from './components/Rules';
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
  { id: 'rules',          label: 'Rules',         icon: SVGRules          },
];

// ── Inline SVG icons ──────────────────────────────────────────────────────────
function SVGOverview({ color }) {
  return <svg width="18" height="18" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}
function SVGAlerts({ color }) {
  return <svg width="18" height="18" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>;
}
function SVGLogs({ color }) {
  return <svg width="18" height="18" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>;
}
function SVGStats({ color }) {
  return <svg width="18" height="18" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}
function SVGMitre({ color }) {
  return <svg width="18" height="18" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function SVGResponse({ color }) {
  return <svg width="18" height="18" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>;
}
function SVGReports({ color }) {
  return <svg width="18" height="18" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
}
function SVGEndpoints({ color }) {
  return <svg width="18" height="18" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>;
}
function SVGTimeline({ color }) {
  return <svg width="18" height="18" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M3 12h6m6 0h6"/><path d="M12 3v6m0 6v6"/></svg>;
}
function SVGInvestigation({ color }) {
  return <svg width="18" height="18" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}

function SVGRules({ color }) {
  return <svg width="18" height="18" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>;
}

// ── Sidebar nav item ───────────────────────────────────────────────────────────
function NavItem({ item, active, onClick, collapsed }) {
  const Icon = item.icon;
  const isActive = active === item.id;
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={() => onClick(item.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '11px 0' : '10px 12px', borderRadius: '10px', marginBottom: '2px',
        background: isActive ? C.bg3 : hover ? C.bg2 : 'transparent',
        border: 'none',
        color: isActive ? C.accent : C.t2,
        cursor: 'pointer', textAlign: 'left',
        fontSize: '14px', fontWeight: isActive ? '600' : '500',
        transition: 'background 0.15s ease, color 0.15s ease',
      }}
    >
      <Icon color={isActive ? C.accent : C.t3} />
      {!collapsed && item.label}
    </button>
  );
}

function IconButton({ label, onClick, children }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} style={{
      width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
      background: C.bg1, color: C.t2, boxShadow: SHADOW_SM,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{children}</button>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]         = useState('overview');
  const [timelineIP, setTimelineIP] = useState('');
  const [focusAlertId, setFocusAlertId] = useState(null);
  const [time, setTime]         = useState(new Date());
  const [theme, setTheme]       = useState(initialTheme);
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1100);
  const [user, setUser]         = useState(() => {
    try { return JSON.parse(localStorage.getItem('cyberx_user') || 'null'); }
    catch { return null; }
  });
  const notes = useNotifications();
  const { sseOk } = useSSE({ onAlert: notes.push });

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem('cyberx_theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);

  // Collapse the sidebar automatically on narrow windows
  useEffect(() => {
    const onResize = () => { if (window.innerWidth < 1000) setCollapsed(true); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const navValue = useMemo(() => ({
    go: setPage,
    openTimeline: (ip) => { setTimelineIP(ip); setPage('timeline'); },
    openAlert: (id) => { setFocusAlertId(id); setPage('alerts'); },
  }), []);
  const navigateToTimeline = navValue.openTimeline;

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
  const sideW = collapsed ? '72px' : '236px';

  return (
    <NavContext.Provider value={navValue}>
    <div className="app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg0, padding: '14px', gap: '14px', fontFamily: FONT }}>
      <a href="#main" className="sr-only">Skip to content</a>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside style={{
        width: sideW, flexShrink: 0,
        background: C.bg1,
        borderRadius: '20px',
        boxShadow: SHADOW,
        display: 'flex', flexDirection: 'column',
        transition: 'width .2s ease',
      }}>
        {/* Logo */}
        <div style={{ padding: collapsed ? '22px 0 12px' : '22px 20px 12px', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px', height: '34px', flexShrink: 0,
              background: C.accent,
              borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
            </div>
            {!collapsed && <div style={{ color: C.t1, fontWeight: '700', fontSize: '18px', letterSpacing: '-0.02em' }}>CyberX</div>}
          </div>
        </div>

        {/* Nav group */}
        <nav aria-label="Main" style={{ flex: 1, padding: '10px 12px', overflowY: 'auto' }}>
          {NAV.map(item => (
            <NavItem key={item.id} item={item} active={page} onClick={setPage} collapsed={collapsed} />
          ))}
        </nav>

        {/* Collapse + user card */}
        <div style={{ padding: '10px 12px 0' }}>
          <button type="button" onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 12,
                           padding: collapsed ? '9px 0' : '9px 12px', borderRadius: 10, border: 'none', background: 'transparent', color: C.t3, cursor: 'pointer', fontSize: 13 }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: collapsed ? 'rotate(180deg)' : 'none' }}>
              <polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/>
            </svg>
            {!collapsed && 'Collapse'}
          </button>
        </div>
        <div style={{ padding: collapsed ? '10px 8px 14px' : '10px 14px 14px', borderTop: `1px solid ${C.b0}`, marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexDirection: collapsed ? 'column' : 'row' }}>
            <div title={`${user.username} (${user.role})`} style={{
              width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
              background: C.bg3, color: C.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: '600',
            }}>
              {user.username?.[0]?.toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: C.t1, fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.username}
                </div>
                <div style={{ color: C.t3, fontSize: '12px', textTransform: 'capitalize' }}>
                  {user.role}
                </div>
              </div>
            )}
            <button onClick={handleLogout} title="Sign out" aria-label="Sign out" style={{
              width: '30px', height: '30px', borderRadius: '8px', border: 'none',
              background: 'transparent', color: C.t3, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <header style={{
          minHeight: '56px', flexShrink: 0, gap: 12, flexWrap: 'wrap',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 8px 0 12px',
        }}>
          <h2 style={{ margin: 0, color: C.t1, fontSize: '15px', fontWeight: '600' }}>{active?.label}</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <GlobalSearch />
            <span style={{ color: C.t3, fontSize: '13px', margin: '0 4px' }} className="hide-narrow">
              {time.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <div role="status" style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: C.bg1, borderRadius: '999px', padding: '8px 14px', boxShadow: SHADOW_SM,
            }}>
              <span className={sseOk ? 'pulse' : ''} aria-hidden="true" style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: sseOk ? C.success : C.t3,
              }} />
              <span style={{ color: C.t2, fontSize: '13px', fontWeight: '500' }}>
                {sseOk ? 'Live' : 'Reconnecting…'}
              </span>
            </div>
            <IconButton label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>
              {theme === 'dark'
                ? <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
                : <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>}
            </IconButton>
            <Bell n={notes} onOpenAlert={navValue.openAlert} />
          </div>
        </header>

        {/* Page content */}
        <main id="main" tabIndex={-1} style={{ flex: 1, overflowY: 'auto', borderRadius: '20px', outline: 'none' }}>
          {page === 'overview'      && <Overview  onNavigate={setPage} user={user} />}
          {page === 'alerts'        && <AlertPanel onTimeline={navigateToTimeline} focusId={focusAlertId} />}
          {page === 'logs'          && <LogFeed />}
          {page === 'stats'         && <StatsChart />}
          {page === 'mitre'         && <MitreMap />}
          {page === 'response'      && <ResponsePanel />}
          {page === 'reports'       && <Reports />}
          {page === 'endpoints'     && <Endpoints />}
          {page === 'timeline'      && <Timeline initialIP={timelineIP} />}
          {page === 'investigation' && <Investigation />}
          {page === 'rules'         && <Rules user={user} />}
        </main>
      </div>

      <Toasts n={notes} onOpenAlert={navValue.openAlert} />
    </div>
    </NavContext.Provider>
  );
}
