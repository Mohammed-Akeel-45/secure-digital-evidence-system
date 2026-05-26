import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Field, ErrorBanner, SuccessBanner } from '../components/auth/FormParts';
import { createMember, getCases, createCase, getCaseUsers, getOrgUsers } from '../api/auth';

const NAV = [
    { type: 'section', label: 'Operations' },
    { id: 'overview', label: 'Overview' },
    { id: 'cases', label: 'Case Management' },
    { id: 'evidence', label: 'Evidence' },
    { type: 'section', label: 'Organization' },
    { id: 'members', label: 'Members' },
    { type: 'section', label: 'Security' },
    { id: 'audit', label: 'Audit Log' },
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
    OPEN: { bg: 'rgba(255,255,255,0.06)', color: '#ccc' },
    IN_PROGRESS: { bg: 'rgba(255,170,0,0.1)', color: '#ffaa00' },
    CLOSED: { bg: 'rgba(255,255,255,0.04)', color: '#555' },
    ARCHIVED: { bg: 'rgba(255,255,255,0.04)', color: '#555' },
    PENDING: { bg: 'rgba(255,170,0,0.1)', color: '#ffaa00' },
    VERIFIED: { bg: 'rgba(0,200,120,0.1)', color: '#00c878' },
    FLAGGED: { bg: 'rgba(255,60,60,0.1)', color: '#ff4444' },
    TAMPERED: { bg: 'rgba(255,60,60,0.15)', color: '#ff2222' },
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

async function computeSHA256(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Overview ──────────────────────────────────────────────────────────────────

function Overview({ cases, evidence }) {
    return (
        <div className="animate-slide">
            <div className="page-title">Admin Overview</div>
            <div className="page-sub">Organization Command Centre</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                <StatCard value={cases.length} label="Total Cases" />
                <StatCard value={cases.filter(c => c.status === 'OPEN' || !c.status).length} label="Open Cases" />
                <StatCard value={evidence.length} label="Evidence Items" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="card">
                    <SectionTitle>Recent Cases</SectionTitle>
                    {cases.length === 0
                        ? <Empty>No cases yet</Empty>
                        : cases.slice(0, 5).map(c => (
                            <Row key={c.public_id}>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', flexShrink: 0, width: 80 }}>{c.public_id?.slice(0, 8)}...</span>
                                <span style={{ flex: 1, fontSize: 13 }}>{c.title}</span>
                                <Badge status={c.status} />
                            </Row>
                        ))}
                </div>
                <div className="card">
                    <SectionTitle>Recent Evidence</SectionTitle>
                    {evidence.length === 0
                        ? <Empty>No evidence uploaded yet</Empty>
                        : evidence.slice(0, 5).map((e, i) => (
                            <Row key={i}>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', flexShrink: 0, width: 60 }}>{e.type}</span>
                                <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                                <Badge status={e.integrityStatus} />
                            </Row>
                        ))}
                </div>
            </div>
        </div>
    );
}

// ── Cases ─────────────────────────────────────────────────────────────────────

function Cases({ cases, onRefresh, onNavigateToEvidence }) {
    const [form, setForm] = useState({ title: '', description: '', priority: 'low' });
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
            await createCase({ title: form.title, description: form.description, priority: form.priority });
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
                                            ? <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', marginBottom: 10 }}>No users assigned</div>
                                            : caseUsers[c.public_id].map(u => (
                                                <div key={u.public_id} style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 4 }}>
                                                    {u.name} <span style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 9 }}>({u.assigned_role})</span>
                                                </div>
                                            ))}
                                        <button className="btn" style={{ fontSize: 10, padding: '5px 12px', marginTop: 6 }} onClick={() => onNavigateToEvidence(c.public_id)}>
                                            View Evidence →
                                        </button>
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
                        <Field label="Priority">
                            <select className="select" value={form.priority} onChange={set('priority')}>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
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

// ── Evidence ──────────────────────────────────────────────────────────────────

const EVIDENCE_TYPES = ['Document', 'Image', 'Video', 'Audio', 'Archive', 'Other'];

function EvidencePage({ cases, evidence, setEvidence, filterCaseId, setFilterCaseId }) {
    const fileRef = useRef();
    const [dragging, setDragging] = useState(false);
    const [file, setFile] = useState(null);
    const [hash, setHash] = useState('');
    const [hashing, setHashing] = useState(false);
    const [form, setForm] = useState({ caseId: filterCaseId || '', type: 'Document', description: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [uploading, setUploading] = useState(false);
    const [verifying, setVerifying] = useState(null);

    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

    const handleFile = async (f) => {
        setFile(f); setHash(''); setSuccess(''); setHashing(true);
        try { const h = await computeSHA256(f); setHash(h); }
        finally { setHashing(false); }
    };

    const handleDrop = (e) => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!file) { setError('NO FILE SELECTED'); return; }
        if (!form.caseId) { setError('SELECT A CASE'); return; }
        setError(''); setUploading(true);
        await new Promise(r => setTimeout(r, 1200));
        const newEvidence = {
            id: crypto.randomUUID(),
            caseId: form.caseId,
            name: file.name,
            type: form.type,
            size: file.size,
            description: form.description,
            sha256: hash,
            uploadedAt: new Date().toISOString(),
            integrityStatus: 'VERIFIED',
            uploadedBy: 'Current User',
        };
        setEvidence(ev => [newEvidence, ...ev]);
        setSuccess(`EVIDENCE "${file.name}" UPLOADED — SHA-256 COMPUTED`);
        setFile(null); setHash('');
        setForm(f => ({ ...f, description: '' }));
        setUploading(false);
    };

    const recheck = async (id) => {
        setVerifying(id);
        await new Promise(r => setTimeout(r, 1000));
        setEvidence(ev => ev.map(e => e.id === id
            ? { ...e, integrityStatus: 'VERIFIED', lastChecked: new Date().toISOString() }
            : e
        ));
        setVerifying(null);
    };

    const filtered = filterCaseId ? evidence.filter(e => e.caseId === filterCaseId) : evidence;
    const caseName = (id) => cases.find(c => c.public_id === id)?.title || id?.slice(0, 8) + '...';

    return (
        <div className="animate-slide">
            <div className="page-title">Evidence</div>
            <div className="page-sub">Upload, manage and verify digital evidence integrity</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <select className="select" style={{ maxWidth: 240 }} value={filterCaseId} onChange={e => setFilterCaseId(e.target.value)}>
                            <option value="">All Cases</option>
                            {cases.map(c => <option key={c.public_id} value={c.public_id}>{c.title}</option>)}
                        </select>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>
                            {filtered.length} ITEM{filtered.length !== 1 ? 'S' : ''}
                        </span>
                    </div>
                    <div className="card" style={{ padding: 0 }}>
                        {filtered.length === 0
                            ? <Empty>No evidence yet{filterCaseId ? ' for this case' : ''}. Upload using the form →</Empty>
                            : filtered.map(ev => (
                                <div key={ev.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--rule2)' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        <div style={{ width: 36, height: 36, background: 'var(--rule2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)', textTransform: 'uppercase' }}>
                                            {ev.type?.slice(0, 3)}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>{caseName(ev.caseId)}</span>
                                                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>{(ev.size / 1024).toFixed(1)} KB</span>
                                                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>{new Date(ev.uploadedAt).toLocaleDateString('en-IN')}</span>
                                                <Badge status={ev.integrityStatus} />
                                            </div>
                                            <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--rule2)' }}>
                                                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)', marginBottom: 3, letterSpacing: '0.08em' }}>SHA-256</div>
                                                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink2)', wordBreak: 'break-all', lineHeight: 1.5 }}>{ev.sha256}</div>
                                            </div>
                                            {ev.lastChecked && <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginTop: 6 }}>Last verified: {new Date(ev.lastChecked).toLocaleString('en-IN')}</div>}
                                            {ev.description && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 6 }}>{ev.description}</div>}
                                        </div>
                                        <div style={{ flexShrink: 0 }}>
                                            <button className="btn" style={{ fontSize: 9, padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => recheck(ev.id)} disabled={verifying === ev.id}>
                                                {verifying === ev.id ? 'Checking...' : 'Verify Integrity'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="card">
                        <SectionTitle>Upload Evidence</SectionTitle>
                        <ErrorBanner message={error} />
                        <SuccessBanner message={success} />
                        <form onSubmit={submit}>
                            <div
                                style={{ border: `1px dashed ${dragging ? 'var(--ink2)' : 'var(--rule)'}`, padding: '24px 16px', textAlign: 'center', marginBottom: 14, cursor: 'pointer', background: dragging ? 'rgba(255,255,255,0.02)' : 'transparent', transition: 'all 0.15s ease' }}
                                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileRef.current.click()}
                            >
                                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
                                {file ? (
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, wordBreak: 'break-all' }}>{file.name}</div>
                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>{(file.size / 1024).toFixed(1)} KB</div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 4 }}>Drop file or click to browse</div>
                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>Any file type accepted</div>
                                    </div>
                                )}
                            </div>
                            {(hashing || hash) && (
                                <div style={{ padding: '8px 10px', background: 'var(--rule2)', marginBottom: 14 }}>
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)', marginBottom: 4, letterSpacing: '0.08em' }}>SHA-256 HASH</div>
                                    {hashing
                                        ? <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>Computing...</div>
                                        : <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: '#00c878', wordBreak: 'break-all', lineHeight: 1.5 }}>{hash}</div>}
                                </div>
                            )}
                            <Field label="Case">
                                <select className="select" value={form.caseId} onChange={set('caseId')}>
                                    <option value="">Select case...</option>
                                    {cases.map(c => <option key={c.public_id} value={c.public_id}>{c.title}</option>)}
                                </select>
                            </Field>
                            <Field label="Evidence Type">
                                <select className="select" value={form.type} onChange={set('type')}>
                                    {EVIDENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </Field>
                            <Field label="Description">
                                <textarea className="input" value={form.description} onChange={set('description')} placeholder="Optional description..." style={{ height: 64, resize: 'none' }} />
                            </Field>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={uploading || hashing}>
                                {uploading ? 'Uploading...' : 'Upload Evidence'}
                            </button>
                        </form>
                    </div>
                    <div className="card">
                        <SectionTitle>Integrity Verification</SectionTitle>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', lineHeight: 2, letterSpacing: '0.04em' }}>
                            <div>▸ SHA-256 computed client-side on upload</div>
                            <div>▸ Hash stored alongside evidence metadata</div>
                            <div>▸ Verify button re-checks hash against record</div>
                            <div>▸ TAMPERED status if hash mismatch detected</div>
                            <div style={{ marginTop: 8, color: 'var(--ink3)', opacity: 0.6 }}>Full cryptographic verification pending backend implementation.</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Members ────────────────────────────────────────────────────────────────────

function Members({ onRefresh }) {
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'officer'
    });

    const [errors, setErrors] = useState({});
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const [members, setMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(true);

    useEffect(() => {
        loadMembers();
    }, []);

    const loadMembers = async () => {
        try {
            setMembersLoading(true);

            const users = await getOrgUsers();

            setMembers(users || []);
        } catch (err) {
            console.error(err);
            setError('FAILED TO LOAD ORGANIZATION USERS');
        } finally {
            setMembersLoading(false);
        }
    };

    const set = (k) => (e) => {
        setForm(f => ({
            ...f,
            [k]: e.target.value
        }));

        setErrors(er => ({
            ...er,
            [k]: ''
        }));
    };

    const validate = () => {
        const errs = {};

        if (!form.name.trim()) {
            errs.name = 'Required';
        }

        if (!form.email.includes('@')) {
            errs.email = 'Valid email required';
        }

        if (form.password.length < 6) {
            errs.password = 'Min 6 characters';
        }

        return errs;
    };

    const submit = async (e) => {
        e.preventDefault();

        const errs = validate();

        if (Object.keys(errs).length) {
            setErrors(errs);
            return;
        }

        setError('');
        setSuccess('');
        setLoading(true);

        try {
            await createMember({
                name: form.name,
                email: form.email,
                password: form.password,
                role: form.role
            });

            setSuccess(`MEMBER "${form.name.toUpperCase()}" CREATED`);

            setForm({
                name: '',
                email: '',
                password: '',
                role: 'officer'
            });

            await loadMembers();

            onRefresh();
        } catch (err) {
            setError(
                err?.message?.toUpperCase() ||
                'FAILED TO CREATE MEMBER'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-slide">
            <div className="page-title">Members</div>

            <div className="page-sub">
                Admin creates and manages all user credentials
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 320px',
                    gap: 16
                }}
            >
                <div className="card">
                    <SectionTitle>
                        Organization Members ({members.length})
                    </SectionTitle>

                    {membersLoading ? (
                        <Empty>Loading members...</Empty>
                    ) : members.length === 0 ? (
                        <Empty>No organization members found.</Empty>
                    ) : (
                        members.map((m) => (
                            <Row key={m.public_id}>
                                <div
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        background: 'var(--rule)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontFamily: 'var(--mono)',
                                        fontSize: 11,
                                        color: 'var(--ink2)',
                                        flexShrink: 0
                                    }}
                                >
                                    {m.name
                                        .split(' ')
                                        .map(n => n[0])
                                        .join('')
                                        .slice(0, 2)
                                        .toUpperCase()}
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            flexWrap: 'wrap'
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 500
                                            }}
                                        >
                                            {m.name}
                                        </div>

                                        {m.is_org_admin && (
                                            <span
                                                style={{
                                                    fontSize: 9,
                                                    padding: '2px 6px',
                                                    borderRadius: 999,
                                                    background: 'rgba(59,130,246,0.12)',
                                                    color: '#3b82f6',
                                                    fontWeight: 600,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5
                                                }}
                                            >
                                                Admin
                                            </span>
                                        )}
                                    </div>

                                    <div
                                        style={{
                                            fontFamily: 'var(--mono)',
                                            fontSize: 9,
                                            color: 'var(--ink3)',
                                            marginTop: 2
                                        }}
                                    >
                                        {m.email}
                                    </div>

                                    {m.roles?.length > 0 && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: 6,
                                                flexWrap: 'wrap',
                                                marginTop: 8
                                            }}
                                        >
                                            {m.roles.map((role) => (
                                                <span
                                                    key={role}
                                                    style={{
                                                        fontSize: 10,
                                                        padding: '3px 8px',
                                                        borderRadius: 999,
                                                        background: 'var(--rule)',
                                                        color: 'var(--ink2)',
                                                        fontWeight: 500,
                                                        textTransform: 'capitalize'
                                                    }}
                                                >
                                                    {role}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Row>
                        ))
                    )}
                </div>

                <div
                    className="card"
                    style={{ alignSelf: 'start' }}
                >
                    <SectionTitle>Add Member</SectionTitle>

                    <div
                        style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 9,
                            color: 'var(--ink3)',
                            marginBottom: 14,
                            lineHeight: 1.7
                        }}
                    >
                        You set the credentials. The member logs in as Officer / User.
                    </div>

                    <ErrorBanner message={error} />
                    <SuccessBanner message={success} />

                    <form onSubmit={submit}>
                        <Field
                            label="Full Name"
                            error={errors.name}
                        >
                            <input
                                className="input"
                                value={form.name}
                                onChange={set('name')}
                                placeholder="Officer full name"
                            />
                        </Field>

                        <Field
                            label="Email"
                            error={errors.email}
                        >
                            <input
                                className="input"
                                type="email"
                                value={form.email}
                                onChange={set('email')}
                                placeholder="officer@dept.gov"
                            />
                        </Field>

                        <Field
                            label="Password"
                            error={errors.password}
                        >
                            <input
                                className="input"
                                type="password"
                                value={form.password}
                                onChange={set('password')}
                                placeholder="Set their password"
                            />
                        </Field>

                        <Field label="Role">
                            <select
                                className="select"
                                value={form.role}
                                onChange={set('role')}
                            >
                                <option value="officer">
                                    Officer / User
                                </option>

                                <option value="analyst">
                                    Forensic Analyst
                                </option>

                                <option value="supervisor">
                                    Supervisor
                                </option>
                            </select>
                        </Field>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                            disabled={loading}
                        >
                            {loading
                                ? 'Creating...'
                                : 'Create Member'}
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
    const { page } = useParams();
    const navigate = useNavigate();
    const [cases, setCases] = useState([]);
    const [evidence, setEvidence] = useState([]);
    const [filterCaseId, setFilterCaseId] = useState('');

    const currentPage = page || 'overview';

    const refresh = async () => {
        try { setCases(await getCases()); } catch { }
    };

    useEffect(() => { refresh(); }, []);

    const navigateToEvidence = (caseId) => {
        setFilterCaseId(caseId);
        navigate('/admin/evidence');
    };

    const pages = {
        overview: <Overview cases={cases} evidence={evidence} />,
        cases: <Cases cases={cases} onRefresh={refresh} onNavigateToEvidence={navigateToEvidence} />,
        evidence: <EvidencePage cases={cases} evidence={evidence} setEvidence={setEvidence} filterCaseId={filterCaseId} setFilterCaseId={setFilterCaseId} />,
        members: <Members onRefresh={refresh} />,
        audit: <Audit />,
    };

    return (
        <AppLayout navItems={NAV} activePage={currentPage} onNavigate={(id) => navigate(`/admin/${id}`)}>
            {pages[currentPage] || pages.overview}
        </AppLayout>
    );
}

