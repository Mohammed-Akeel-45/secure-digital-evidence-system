import { useState, useEffect } from 'react';
import { AppLayout } from '../components/AppLayout';
import { getCases } from '../api/auth';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { type: 'section', label: 'My Work' },
  { id: 'cases',    label: 'My Cases' },
  { id: 'evidence', label: 'Evidence' },
  { type: 'section', label: 'Reports' },
  { id: 'audit',    label: 'Audit Log' },
];

const BADGE_COLORS = {
  open:        { bg: 'rgba(0,200,255,0.1)',  color: 'var(--accent)' },
  in_progress: { bg: 'rgba(255,170,0,0.1)', color: 'var(--warn)' },
  closed:      { bg: 'rgba(90,122,144,0.1)', color: 'var(--text2)' },
  archived:    { bg: 'rgba(90,122,144,0.1)', color: 'var(--text2)' },
};

function Badge({ type, children }) {
  const s = BADGE_COLORS[type?.toLowerCase()] || BADGE_COLORS.open;
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', borderRadius: 1, background: s.bg, color: s.color, textTransform: 'uppercase' }}>
      {children}
    </span>
  );
}

function MyCases() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCases()
      .then(setCases)
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-slide">
      <div className="page-title">MY CASES</div>
      <div className="page-sub">CASES ASSIGNED TO YOU BY YOUR ADMINISTRATOR</div>
      <div className="card">
        {loading && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text2)', padding: 20, textAlign: 'center' }}>
            LOADING...
          </div>
        )}
        {!loading && cases.length === 0 && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text2)', padding: 20, textAlign: 'center' }}>
            No cases assigned to you yet.
          </div>
        )}
        {!loading && cases.map((c) => (
          <div key={c.public_id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)' }}>{c.public_id?.slice(0, 8)}...</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{c.title}</span>
              <Badge type={c.status?.toLowerCase()}>{c.status}</Badge>
            </div>
            {c.description && (
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{c.description}</div>
            )}
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text2)', marginTop: 4 }}>
              Opened: {new Date(c.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Placeholder({ title, sub }) {
  return (
    <div className="animate-slide">
      <div className="page-title">{title}</div>
      <div className="page-sub">{sub}</div>
      <div className="card">
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text2)', padding: 20, textAlign: 'center' }}>
          Connect to the relevant service endpoint to view this data.
        </div>
      </div>
    </div>
  );
}

export function UserDashboard() {
  const [page, setPage] = useState('cases');

  const pages = {
    cases:    <MyCases />,
    evidence: <Placeholder title="EVIDENCE" sub="EVIDENCE ASSIGNED TO YOUR CASES" />,
    audit:    <Placeholder title="AUDIT LOG" sub="YOUR ACCESS AND ACTION HISTORY" />,
  };

  return (
    <AppLayout navItems={NAV} activePage={page} onNavigate={setPage}>
      {pages[page] || pages.cases}
    </AppLayout>
  );
}
