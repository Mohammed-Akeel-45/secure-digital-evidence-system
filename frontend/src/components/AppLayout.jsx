import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, decodeJWT } from '../context/AuthContext';
import styles from './AppLayout.module.css';

function SessionTimer() {
  const { token, logout } = useAuth();
  const [remaining, setRemaining] = React.useState(null);

  React.useEffect(() => {
    if (!token) {
      setRemaining(null);
      return;
    }

    const claims = decodeJWT(token);
    if (!claims || !claims.exp) {
      setRemaining(null);
      return;
    }

    const expTime = claims.exp;

    const checkTime = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = expTime - now;
      if (diff <= 0) {
        setRemaining(0);
        logout();
      } else {
        setRemaining(diff);
      }
    };

    checkTime();
    const id = setInterval(checkTime, 1000);
    return () => clearInterval(id);
  }, [token, logout]);

  if (remaining === null) return null;

  const isExpired = remaining <= 0;
  const isCritical = remaining > 0 && remaining <= 120;
  const isWarning = remaining > 120 && remaining <= 300;
  const hrs = Math.floor(remaining / 3600);
  const mins = Math.floor((remaining % 3600) / 60);
  const secs = remaining % 60;

  let timeString = '';
  if (hrs > 0) {
    timeString = `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  } else {
    timeString = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  const statusColor = isExpired || isCritical ? '#ff4444' : isWarning ? '#f5a623' : '#00c878';
  const borderColor = isExpired || isCritical ? 'rgba(255, 68, 68, 0.4)' : isWarning ? 'rgba(245, 166, 35, 0.4)' : 'var(--rule2)';

  return (
    <div
      className={styles.sessionTimer}
      title={isExpired ? 'Session Expired' : `Session time remaining: ${timeString}`}
      style={{ borderColor }}
    >
      <span className={styles.sessionPulse} style={{ background: statusColor }} />
      <span className={styles.sessionLabel}>SESSION</span>
      <span className={styles.sessionTime} style={{ color: isExpired || isCritical ? '#ff4444' : isWarning ? '#f5a623' : 'var(--ink)' }}>
        {isExpired ? 'EXPIRED' : timeString}
      </span>
    </div>
  );
}

function ISTClock() {
  const [t, setT] = React.useState(new Date());
  React.useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const ist = new Date(t.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hh = String(ist.getHours()).padStart(2, '0');
  const mm = String(ist.getMinutes()).padStart(2, '0');
  const ss = String(ist.getSeconds()).padStart(2, '0');
  const date = ist.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className={styles.clock}>
      <span className={styles.clockTime}>{hh}:{mm}:{ss}</span>
      <span className={styles.clockDate}>{date} IST</span>
    </div>
  );
}

const ICONS = {
  overview:    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  cases:       'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  departments: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  members:     'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  roles:       'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  audit:       'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  custody:     'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  evidence:    'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
};

const ADMIN_NAV = [
  { type: 'section', label: 'Operations' },
  { id: 'overview', label: 'Overview' },
  { id: 'cases', label: 'Case Management' },
  { id: 'evidence', label: 'Evidence Vault' },
  { type: 'section', label: 'Organization' },
  { id: 'members', label: 'Members' },
  { id: 'departments', label: 'Departments' },
  { type: 'section', label: 'Security & Audit' },
  { id: 'roles', label: 'Roles & RBAC' },
  { id: 'custody', label: 'Chain of Custody' },
  { id: 'audit', label: 'Audit Logs' },
];

const USER_NAV = [
  { type: 'section', label: 'My Work' },
  { id: 'cases', label: 'My Cases' },
  { id: 'evidence', label: 'Evidence Vault' },
  { type: 'section', label: 'Security & Integrity' },
  { id: 'custody', label: 'Chain of Custody' },
  { id: 'audit', label: 'Audit Trail' },
];

function NavIcon({ id }) {
  const d = ICONS[id] || ICONS.overview;
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {d.split('M').filter(Boolean).map((seg, i) => (
        <path key={i} d={'M' + seg} />
      ))}
    </svg>
  );
}

export function AppLayout({ navItems, activePage, onNavigate, children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const effectiveNavItems = navItems || (isAdmin ? ADMIN_NAV : USER_NAV);

  // Derive active page if not explicitly supplied
  let currentActive = activePage;
  if (!currentActive) {
    const path = location.pathname;
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 2) {
      currentActive = parts[1];
    } else {
      currentActive = isAdmin ? 'overview' : 'cases';
    }
  }

  // Handle navigation
  const handleNavigate = (id) => {
    if (onNavigate) {
      onNavigate(id);
    } else {
      const base = isAdmin ? '/admin' : '/dashboard';
      navigate(`${base}/${id}`);
    }
  };

  const activeLabel = effectiveNavItems.find(n => n.id === currentActive)?.label || currentActive?.toUpperCase() || '';

  // Group nav items by section
  const sections = [];
  let current = { label: '', items: [] };
  effectiveNavItems.forEach(item => {
    if (item.type === 'section') {
      if (current.items.length) sections.push(current);
      current = { label: item.label, items: [] };
    } else {
      current.items.push(item);
    }
  });
  if (current.items.length) sections.push(current);

  return (
    <div className={styles.root}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        {/* Logo */}
        <div className={styles.sidebarLogo} onClick={() => navigate(isAdmin ? '/admin/overview' : '/dashboard/cases')} style={{ cursor: 'pointer' }}>
          <img src="/SDESlogo_512.svg" alt="SDES" className={styles.logoMark} />
          <div>
            <div className={styles.logoName}>SDES</div>
            <div className={styles.logoTagline}>Evidence System</div>
          </div>
        </div>

        {/* Nav sections */}
        <nav className={styles.nav}>
          {sections.map((section) => (
            <div key={section.label} className={styles.navGroup}>
              {section.label && (
                <div className={styles.navGroupLabel}>{section.label}</div>
              )}
              {section.items.map((item) => {
                const active = currentActive === item.id;
                return (
                  <button
                    key={item.id}
                    className={`${styles.navItem} ${active ? styles.navActive : ''}`}
                    onClick={() => handleNavigate(item.id)}
                  >
                    <span className={styles.navIcon}>
                      <NavIcon id={item.id} />
                    </span>
                    <span className={styles.navLabel}>{item.label}</span>
                    {active && <span className={styles.navArrow}>›</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User block at bottom */}
        <div className={styles.sidebarUser}>
          <div className={styles.userAvatar}>
            {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
          </div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{user?.name || 'User'}</div>
            <div className={styles.userRole}>{isAdmin ? 'Administrator' : 'Officer'}</div>
          </div>
          <button className={styles.logoutBtn} onClick={logout} title="Logout">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className={styles.mainWrap}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            <span className={styles.breadcrumbRoot}>SDES</span>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbPage}>{activeLabel}</span>
          </div>
          <div className={styles.topbarActions}>
            <SessionTimer />
            <ISTClock />
          </div>
        </header>

        {/* Page content */}
        <main className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}

