import { useState, useEffect } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Field, ErrorBanner, SuccessBanner } from '../components/auth/FormParts';
import { createMember, getCases, createCase, getCaseUsers } from '../api/auth';

const NAV = [
  { type: 'section', label: 'Operations' },
  { id: 'overview', label: 'Overview' },
  { id: 'cases',    label: 'Case Management' },
  { type: 'section', label: 'Organization' },
  { id: 'members',  label: 'Members' },
  { type: 'section', label: 'Security' },
  { id: 'audit',    label: 'Audit Log' },
];

function SectionTitle({ children }) {
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--rule2)' }}>
      {children}
    </div>
  );
}

function Row({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--rule2)', cursor: onClick ? 'pointer' : 'default', ...style }}>
      {children}
    </div>
  );
}

function Empty({ children }) {
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', padding: '24px 0', textAlign: 'center' }}>
      {children}
    </div>
  );
}

const STATUS_COLORS = {
  OPEN:        { bg: 'rgba(255,255,255,0.06)', color: '#ccc' },
  IN_PROGRESS: { bg: 'rgba(255,170,0,0.1)',    color: '#ffaa00' },
  CLOSED:      { bg: 'rgba(255,255,255,0.04)', color: '#555' },
  ARCHIVED:    { bg: 'rgba(255,255,255,0.04)', color: '#555' },
};

function Badge({ status }) {
  const s = STATUS_COLORS[status?.toUpperCase()] || STATUS_COLORS.OPEN;
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em', background: s.bg, color: s.color, textTransform: 'uppercase' }}>
      {status || 'OPEN'}
    </span>
  );
}

function StatCard({ value, label }) {
  return (
    <div className="card">
      <div style={{ fontFamily: 'Stardom, serif', fontSize: 40, color: 'var(--ink)', lineHeight: 1, marginBottom: 8 }}>{value}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function Overview({ cases }) {
  return (
    <div className="animate-slide">
      <div className="page-title">Admin Overview</div>
      <div className="page-sub">Organization Command Centre</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard value={cases.length} label="Total Cases" />
        <StatCard value={cases.filter(c => c.status === 'OPEN' || !c.status).length} label="Open Cases" />
      </div>
      <div className="card">
        <SectionTitle>Recent Cases</SectionTitle>
        {cases.length === 0
          ? <Empty>No cases yet — create one in Case Management</Empty>
          : cases.slice(0, 6).map(c => (
            <Row key={c.public_id}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', flexShrink: 0, width: 80 }}>{c.public_id?.slice(0, 8)}...</span>
              <span style={{ flex: 1, fontSize: 13 }}>{c.title}</span>
              <Badge status={c.status} />
            </Row>
          ))}
      </div>
    </div>
  );
}

// ── Cases ─────────────────────────────────────────────────────────────────────

function Cases({ cases, onRefresh }) {
  const [form, setForm] = useState({ title: '', description: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [caseUsers, setCaseUsers] = useState({});

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('TITLE IS REQUIRED'); return; }
    setError(''); setSuccess(''); setLoading(true);
    try {
      await createCase({ title: form.title, description: form.description });
      setSuccess('CASE CREATED');
      setForm({ title: '', description: '' });
      onRefresh();
    } catch (err) {
      setError(err.message.toUpperCase());
    } finally { setLoading(false); }
  };

  const expand = async (caseId) => {
    if (expanded === caseId) { setExpanded(null); return; }
    setExpanded(caseId);
    if (!caseUsers[caseId]) {
      try {
        const users = await getCaseUsers(caseId);
        setCaseUsers(u => ({ ...u, [caseId]: users }));
      } catch { setCaseUsers(u => ({ ...u, [caseId]: [] })); }
    }
  };

  return (
    <div className="animate-slide">
      <div className="page-title">Case Management</div>
      <div className="page-sub">Create and manage investigation cases</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <div className="card">
          <SectionTitle>All Cases ({cases.length})</SectionTitle>
          {cases.length === 0
            ? <Empty>No cases yet. Create your first case →</Empty>
            : cases.map(c => (
              <div key={c.public_id}>
                <Row onClick={() => expand(c.public_id)}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', width: 80, flexShrink: 0 }}>{c.public_id?.slice(0, 8)}...</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{c.title}</span>
                  <Badge status={c.status} />
                  <span style={{ color: 'var(--ink3)', fontSize: 12, marginLeft: 4 }}>{expanded === c.public_id ? '▾' : '▸'}</span>
                </Row>
                {expanded === c.public_id && (
                  <div style={{ padding: '12px 0 12px 90px', animation: 'fade-in 0.2s ease' }}>
                    {c.description && <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 10 }}>{c.description}</div>}
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginBottom: 6, letterSpacing: '0.08em' }}>ASSIGNED USERS</div>
                    {!(caseUsers[c.public_id]?.length)
                      ? <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>No users assigned</div>
                      : caseUsers[c.public_id].map(u => (
                        <div key={u.public_id} style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 4 }}>
                          {u.name} <span style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 9 }}>({u.assigned_role})</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
        </div>
        <div className="card" style={{ alignSelf: 'start' }}>
          <SectionTitle>New Case</SectionTitle>
          <ErrorBanner message={error} />
          <SuccessBanner message={success} />
          <form onSubmit={submit}>
            <Field label="Title">
              <input className="input" value={form.title} onChange={set('title')} placeholder="Case title" />
            </Field>
            <Field label="Description">
              <textarea className="input" value={form.description} onChange={set('description')} placeholder="Optional details..." style={{ height: 80, resize: 'none' }} />
            </Field>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Creating...' : 'Create Case'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Members ────────────────────────────────────────────────────────────────────

function Members({ onRefresh }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState([]);

  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(er => ({ ...er, [k]: '' })); };

  const validate = () => {
    const errs = {};
    if (!form.name.trim())         errs.name = 'Required';
    if (!form.email.includes('@')) errs.email = 'Valid email required';
    if (form.password.length < 6)  errs.password = 'Min 6 characters';
    return errs;
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setError(''); setSuccess(''); setLoading(true);
    try {
      await createMember({ name: form.name, email: form.email, password: form.password, role: form.role });
      setSuccess(`MEMBER "${form.name.toUpperCase()}" CREATED`);
      setCreated(c => [...c, { name: form.name, email: form.email, role: form.role }]);
      setForm({ name: '', email: '', password: '', role: 'user' });
      onRefresh();
    } catch (err) {
      setError(err.message.toUpperCase());
    } finally { setLoading(false); }
  };

  return (
    <div className="animate-slide">
      <div className="page-title">Members</div>
      <div className="page-sub">Admin creates and manages all user credentials</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <div className="card">
          <SectionTitle>Created This Session ({created.length})</SectionTitle>
          {created.length === 0
            ? <Empty>Members you create will appear here.</Empty>
            : created.map((m, i) => (
              <Row key={i}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink2)', flexShrink: 0 }}>
                  {m.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginTop: 2 }}>{m.email}</div>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase' }}>{m.role}</span>
              </Row>
            ))}
        </div>
        <div className="card" style={{ alignSelf: 'start' }}>
          <SectionTitle>Add Member</SectionTitle>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginBottom: 14, lineHeight: 1.7 }}>
            You set the credentials. The member logs in as Officer / User.
          </div>
          <ErrorBanner message={error} />
          <SuccessBanner message={success} />
          <form onSubmit={submit}>
            <Field label="Full Name" error={errors.name}>
              <input className="input" value={form.name} onChange={set('name')} placeholder="Officer full name" />
            </Field>
            <Field label="Email" error={errors.email}>
              <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="officer@dept.gov" />
            </Field>
            <Field label="Password" error={errors.password}>
              <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="Set their password" />
            </Field>
            <Field label="Role">
              <select className="select" value={form.role} onChange={set('role')}>
                <option value="user">Officer / User</option>
                <option value="analyst">Forensic Analyst</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </Field>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Creating...' : 'Create Member'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Audit ──────────────────────────────────────────────────────────────────────

function Audit() {
  return (
    <div className="animate-slide">
      <div className="page-title">Audit Log</div>
      <div className="page-sub">Immutable access and action log</div>
      <div className="card">
        <Empty>Audit log endpoint not yet exposed via HTTP.</Empty>
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [page, setPage] = useState('overview');
  const [cases, setCases] = useState([]);

  const refresh = async () => {
    try { setCases(await getCases()); } catch {}
  };

  useEffect(() => { refresh(); }, []);

  const pages = {
    overview: <Overview cases={cases} />,
    cases:    <Cases cases={cases} onRefresh={refresh} />,
    members:  <Members onRefresh={refresh} />,
    audit:    <Audit />,
  };

  return (
    <AppLayout navItems={NAV} activePage={page} onNavigate={setPage}>
      {pages[page]}
    </AppLayout>
  );
}

