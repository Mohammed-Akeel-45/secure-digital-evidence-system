import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Field, ErrorBanner, SuccessBanner } from '../components/auth/FormParts';
import {
    createMember,
    getCases,
    createCase,
    getCaseUsers,
    getOrgUsers,
    createDepartment,
    deleteDepartment,
    getOrgDepartments,
    createRole,
    deleteRole,
    getOrgRoles,
    getAllPermissions,
    getEvidence,
    uploadEvidence,
    downloadEvidence
} from '../api/auth';

const NAV = [
    { type: 'section', label: 'Operations' },
    { id: 'overview', label: 'Overview' },
    { id: 'cases', label: 'Case Management' },
    { type: 'section', label: 'Organization' },
    { id: 'members', label: 'Members' },
    { id: 'departments', label: 'Departments' },
    { type: 'section', label: 'Security' },
    { id: 'roles', label: 'Roles' },
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

function Cases({ cases, onRefresh }) {
    const [expanded, setExpanded] = useState(null);
    const [caseUsers, setCaseUsers] = useState({});

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
            <div className="page-sub">View and manage investigation cases and evidence</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
                <div className="card">
                    <SectionTitle>All Cases ({cases.length})</SectionTitle>
                    {cases.length === 0
                        ? <Empty>No cases yet.</Empty>
                        : cases.map(c => (
                            <div key={c.public_id} style={{ borderBottom: '1px solid var(--rule2)', paddingBottom: 12 }}>
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
                                                    {u.name}
                                                </div>
                                            ))}

                                        <div style={{ borderTop: '1px solid var(--rule2)', marginTop: 12, paddingTop: 12 }}>
                                            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginBottom: 6, letterSpacing: '0.08em' }}>CASE EVIDENCE</div>
                                            <EvidenceSection caseId={c.public_id} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                </div>
                <div className="card" style={{ alignSelf: 'start' }}>
                    <SectionTitle>Case Creation Relocated</SectionTitle>
                    <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.5 }}>
                        To create a new case, go to the <strong>Departments</strong> screen, click a department to view it, and use the creation form there.
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Evidence Section (Case Level) ────────────────────────────────────────────────
const EVIDENCE_TYPES = ['Document', 'Image', 'Video', 'Audio', 'Archive', 'Other'];

function EvidenceSection({ caseId }) {
    const fileRef = useRef();
    const [dragging, setDragging] = useState(false);
    const [file, setFile] = useState(null);
    const [hash, setHash] = useState('');
    const [hashing, setHashing] = useState(false);
    const [form, setForm] = useState({ type: 'Document', description: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [uploading, setUploading] = useState(false);
    const [verifying, setVerifying] = useState(null);
    const [evidence, setEvidence] = useState([]);
    const [loading, setLoading] = useState(true);

    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

    const loadEvidence = async () => {
        setLoading(true);
        try {
            const list = await getEvidence(caseId);
            setEvidence(list || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (caseId) {
            loadEvidence();
            setFile(null);
            setHash('');
            setError('');
            setSuccess('');
        }
    }, [caseId]);

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
        setError(''); setSuccess(''); setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('case_id', caseId);
            formData.append('type', form.type);
            formData.append('description', form.description);

            await uploadEvidence(formData);
            setSuccess(`EVIDENCE "${file.name}" UPLOADED SUCCESSFULLY`);
            setFile(null); setHash('');
            setForm(f => ({ ...f, description: '' }));
            await loadEvidence();
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally { setUploading(false); }
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

    const handleDownload = async (ev) => {
        try {
            const blob = await downloadEvidence(ev.public_id);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', ev.file_name);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            setError('DOWNLOAD FAILED: ' + err.message.toUpperCase());
        }
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginTop: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>
                        {evidence.length} EVIDENCE ITEM{evidence.length !== 1 ? 'S' : ''} FOR THIS CASE
                    </span>
                </div>
                <div className="card" style={{ padding: 0, maxHeight: 400, overflowY: 'auto' }}>
                    {loading ? (
                        <Empty>Loading evidence...</Empty>
                    ) : evidence.length === 0 ? (
                        <Empty>No evidence uploaded yet. Use the form to upload →</Empty>
                    ) : (
                        evidence.map(ev => (
                            <div key={ev.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--rule2)' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                    <div style={{ width: 36, height: 36, background: 'var(--rule2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)', textTransform: 'uppercase' }}>
                                        {ev.file_name.split('.').pop()?.slice(0, 3) || 'BIN'}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.file_name}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>{(ev.file_size / 1024).toFixed(1)} KB</span>
                                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>{new Date(ev.uploaded_at).toLocaleDateString('en-IN')}</span>
                                            <Badge status={ev.integrityStatus || 'VERIFIED'} />
                                        </div>
                                        <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--rule2)' }}>
                                            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)', marginBottom: 3, letterSpacing: '0.08em' }}>SHA-256</div>
                                            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink2)', wordBreak: 'break-all', lineHeight: 1.5 }}>{ev.current_hash}</div>
                                        </div>
                                        {ev.lastChecked && <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginTop: 6 }}>Last verified: {new Date(ev.lastChecked).toLocaleString('en-IN')}</div>}
                                    </div>
                                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <button className="btn" style={{ fontSize: 9, padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => handleDownload(ev)}>
                                            Download
                                        </button>
                                        <button className="btn" style={{ fontSize: 9, padding: '4px 10px', whiteSpace: 'nowrap' }} onClick={() => recheck(ev.id)} disabled={verifying === ev.id}>
                                            {verifying === ev.id ? 'Checking...' : 'Verify'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
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

// ── Departments Screen ─────────────────────────────────────────────────────────
function Departments() {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [creating, setCreating] = useState(false);

    // Selected department state for cases and case creation
    const [selectedDept, setSelectedDept] = useState(null);
    const [deptCases, setDeptCases] = useState([]);
    const [casesLoading, setCasesLoading] = useState(false);

    // Case creation form under selected department
    const [caseForm, setCaseForm] = useState({ title: '', description: '', priority: 'low' });
    const [caseError, setCaseError] = useState('');
    const [caseSuccess, setCaseSuccess] = useState('');
    const [caseCreating, setCaseCreating] = useState(false);

    const loadDepartments = async () => {
        setLoading(true);
        try {
            const list = await getOrgDepartments();
            setDepartments(list || []);
        } catch (err) {
            setError('FAILED TO LOAD DEPARTMENTS');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDepartments();
    }, []);

    const loadDeptCases = async (dept) => {
        setCasesLoading(true);
        try {
            const list = await getCases(dept.public_id);
            setDeptCases(list || []);
        } catch (err) {
            console.error(err);
        } finally {
            setCasesLoading(false);
        }
    };

    const handleSelectDept = (dept) => {
        if (selectedDept?.public_id === dept.public_id) {
            setSelectedDept(null);
            setDeptCases([]);
        } else {
            setSelectedDept(dept);
            setCaseError('');
            setCaseSuccess('');
            loadDeptCases(dept);
        }
    };

    const handleCreateDept = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { setError('NAME IS REQUIRED'); return; }
        setError(''); setSuccess(''); setCreating(true);
        try {
            await createDepartment({ name: form.name });
            setSuccess(`DEPARTMENT "${form.name.toUpperCase()}" CREATED`);
            setForm({ name: '' });
            await loadDepartments();
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteDept = async (deptId, deptName) => {
        if (!window.confirm(`Are you sure you want to delete department "${deptName}"?`)) return;
        try {
            await deleteDepartment(deptId);
            if (selectedDept?.public_id === deptId) {
                setSelectedDept(null);
                setDeptCases([]);
            }
            await loadDepartments();
        } catch (err) {
            console.log(err);
            setError("FAILED TO DELETE DEPARTMENT");
        }
    };

    const handleCreateCase = async (e) => {
        e.preventDefault();
        if (!caseForm.title.trim()) { setCaseError('TITLE IS REQUIRED'); return; }
        setCaseError(''); setCaseSuccess(''); setCaseCreating(true);
        try {
            await createCase({
                title: caseForm.title,
                description: caseForm.description,
                priority: caseForm.priority,
                dept_id: selectedDept.public_id
            });
            setCaseSuccess('CASE CREATED UNDER ' + selectedDept.name.toUpperCase());
            setCaseForm({ title: '', description: '', priority: 'low' });
            await loadDeptCases(selectedDept);
        } catch (err) {
            setCaseError(err.message.toUpperCase());
        } finally {
            setCaseCreating(false);
        }
    };

    return (
        <div className="animate-slide">
            <div className="page-title">Departments</div>
            <div className="page-sub">Manage organization departments and their cases</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="card">
                        <SectionTitle>All Departments ({departments.length})</SectionTitle>
                        {loading ? (
                            <Empty>Loading departments...</Empty>
                        ) : departments.length === 0 ? (
                            <Empty>No departments found. Create your first department →</Empty>
                        ) : (
                            departments.map(d => (
                                <div key={d.public_id} style={{ borderBottom: '1px solid var(--rule2)', paddingBottom: 8, marginBottom: 8 }}>
                                    <Row onClick={() => handleSelectDept(d)}>
                                        <div style={{ flex: 1, fontWeight: 500, fontSize: 13 }}>{d.name}</div>
                                        <button
                                            className="btn"
                                            style={{ fontSize: 9, padding: '3px 8px', marginRight: 8, background: 'rgba(255, 68, 68, 0.1)', color: '#ff4444' }}
                                            onClick={(e) => { e.stopPropagation(); handleDeleteDept(d.public_id, d.name); }}
                                        >
                                            Delete
                                        </button>
                                        <span style={{ color: 'var(--ink3)', fontSize: 12 }}>{selectedDept?.public_id === d.public_id ? '▾' : '▸'}</span>
                                    </Row>
                                    {selectedDept?.public_id === d.public_id && (
                                        <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.01)', marginTop: 8 }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
                                                <div>
                                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginBottom: 8, letterSpacing: '0.08em' }}>DEPARTMENT CASES ({deptCases.length})</div>
                                                    {casesLoading ? (
                                                        <Empty>Loading cases...</Empty>
                                                    ) : deptCases.length === 0 ? (
                                                        <Empty>No cases created for this department yet.</Empty>
                                                    ) : (
                                                        deptCases.map(c => (
                                                            <div key={c.public_id} style={{ padding: '8px 0', borderBottom: '1px solid var(--rule2)' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <span style={{ fontSize: 10, color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>{c.public_id.slice(0, 8)}...</span>
                                                                    <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{c.title}</span>
                                                                    <Badge status={c.status} />
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                                <div style={{ borderLeft: '1px solid var(--rule2)', paddingLeft: 16 }}>
                                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginBottom: 8, letterSpacing: '0.08em' }}>CREATE CASE IN DEPARTMENT</div>
                                                    <ErrorBanner message={caseError} />
                                                    <SuccessBanner message={caseSuccess} />
                                                    <form onSubmit={handleCreateCase}>
                                                        <Field label="Title">
                                                            <input className="input" style={{ fontSize: 11 }} value={caseForm.title} onChange={e => setCaseForm(cf => ({ ...cf, title: e.target.value }))} placeholder="Case title" />
                                                        </Field>
                                                        <Field label="Description">
                                                            <textarea className="input" style={{ fontSize: 11, height: 50, resize: 'none' }} value={caseForm.description} onChange={e => setCaseForm(cf => ({ ...cf, description: e.target.value }))} placeholder="Optional details..." />
                                                        </Field>
                                                        <Field label="Priority">
                                                            <select className="select" style={{ fontSize: 11 }} value={caseForm.priority} onChange={e => setCaseForm(cf => ({ ...cf, priority: e.target.value }))}>
                                                                <option value="low">Low</option>
                                                                <option value="medium">Medium</option>
                                                                <option value="high">High</option>
                                                            </select>
                                                        </Field>
                                                        <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: 11, padding: '6px' }} disabled={caseCreating}>
                                                            {caseCreating ? 'Creating...' : 'Create Case'}
                                                        </button>
                                                    </form>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <div className="card" style={{ alignSelf: 'start' }}>
                    <SectionTitle>New Department</SectionTitle>
                    <ErrorBanner message={error} />
                    <SuccessBanner message={success} />
                    <form onSubmit={handleCreateDept}>
                        <Field label="Department Name">
                            <input className="input" value={form.name} onChange={e => { setForm({ name: e.target.value }); setError(''); }} placeholder="e.g. Homicide, Cybercrime" />
                        </Field>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={creating}>
                            {creating ? 'Creating...' : 'Create Department'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

// ── Roles Screen ───────────────────────────────────────────────────────────────
function Roles({ cases }) {
    const [roles, setRoles] = useState([]);
    const [rolesLoading, setRolesLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ORG'); // ORG, DEPARTMENT, CASE
    const [allPermissions, setAllPermissions] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedScopeEntity, setSelectedScopeEntity] = useState('');

    // Creation Form State
    const [form, setForm] = useState({ name: '', description: '' });
    const [selectedPermissions, setSelectedPermissions] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [creating, setCreating] = useState(false);

    const loadRoles = async () => {
        setRolesLoading(true);
        try {
            const list = await getOrgRoles(activeTab);
            setRoles(list || []);
        } catch (err) {
            console.error(err);
        } finally {
            setRolesLoading(false);
        }
    };

    const loadPermissions = async () => {
        try {
            const list = await getAllPermissions();
            setAllPermissions(list || []);
        } catch (err) {
            console.error(err);
        }
    };

    const loadDepartments = async () => {
        try {
            const list = await getOrgDepartments();
            setDepartments(list || []);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        loadRoles();
        setSelectedScopeEntity('');
    }, [activeTab]);

    useEffect(() => {
        loadPermissions();
        loadDepartments();
    }, []);

    const togglePermission = (name) => {
        setSelectedPermissions(prev =>
            prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
        );
    };

    const handleCreateRole = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { setError('ROLE NAME IS REQUIRED'); return; }
        if (selectedPermissions.length === 0) { setError('SELECT AT LEAST ONE PERMISSION'); return; }
        if (activeTab !== 'ORG' && !selectedScopeEntity) {
            setError(`PLEASE SELECT A TARGET ${activeTab} CONTEXT`);
            return;
        }

        setError(''); setSuccess(''); setCreating(true);
        try {
            await createRole({
                name: form.name,
                description: form.description,
                permissions: selectedPermissions,
                scopeType: activeTab,
                scopeId: selectedScopeEntity
            });
            setSuccess(`ROLE "${form.name.toUpperCase()}" CREATED`);
            setForm({ name: '', description: '' });
            setSelectedPermissions([]);
            setSelectedScopeEntity('');
            await loadRoles();
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteRole = async (name, scopeType, scopeId) => {
        if (!window.confirm(`Are you sure you want to delete role "${name}"?`)) return;
        try {
            await deleteRole(name, scopeType, scopeId);
            await loadRoles();
        } catch (err) {
            console.error(err);
            setError('FAILED TO DELETE ROLE');
        }
    };

    return (
        <div className="animate-slide">
            <div className="page-title">Role Management</div>
            <div className="page-sub">Configure organization, department and case scopes roles and attach permissions</div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--rule2)', paddingBottom: 8 }}>
                {['ORG', 'DEPARTMENT', 'CASE'].map(tab => (
                    <button
                        key={tab}
                        className={`btn ${activeTab === tab ? 'btn-primary' : ''}`}
                        style={{ fontSize: 10, padding: '6px 16px', textTransform: 'uppercase' }}
                        onClick={() => { setActiveTab(tab); setError(''); setSuccess(''); }}
                    >
                        {tab} Roles
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
                <div className="card">
                    <SectionTitle>{activeTab} Roles List ({roles.length})</SectionTitle>
                    {rolesLoading ? (
                        <Empty>Loading roles...</Empty>
                    ) : roles.length === 0 ? (
                        <Empty>No {activeTab.toLowerCase()} roles found. Create one →</Empty>
                    ) : (
                        roles.map(r => (
                            <div key={r.public_id} style={{ padding: '12px 0', borderBottom: '1px solid var(--rule2)' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {r.name}
                                            <span style={{ fontSize: 9, background: 'var(--rule2)', padding: '2px 6px', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>{r.scope_name || ""}</span>
                                        </div>
                                        {r.description && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>{r.description}</div>}
                                    </div>
                                    {r.name !== "ORG_ADMIN" && <button
                                        className="btn"
                                        style={{ fontSize: 9, padding: '4px 10px', background: 'rgba(255, 68, 68, 0.1)', color: '#ff4444' }}
                                        onClick={() => handleDeleteRole(r.name, r.scope_type, r.scope_id)}
                                    >
                                        Delete
                                    </button>
                                    }
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="card">
                    <SectionTitle>New {activeTab} Role</SectionTitle>
                    <ErrorBanner message={error} />
                    <SuccessBanner message={success} />
                    <form onSubmit={handleCreateRole}>
                        <Field label="Role Name">
                            <input className="input" value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError(''); }} placeholder="e.g. DEPT_HEAD, INVESTIGATOR" />
                        </Field>
                        <Field label="Description">
                            <textarea className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Explain role responsibilities..." style={{ height: 60, resize: 'none' }} />
                        </Field>
                        {activeTab === 'DEPARTMENT' && (
                            <Field label="Select Department">
                                <select className="select" value={selectedScopeEntity} onChange={e => { setSelectedScopeEntity(e.target.value); setError(''); }}>
                                    <option value="">Choose department...</option>
                                    {departments.map(d => <option key={d.public_id} value={d.public_id}>{d.name}</option>)}
                                </select>
                            </Field>
                        )}
                        {activeTab === 'CASE' && (
                            <Field label="Select Case">
                                <select className="select" value={selectedScopeEntity} onChange={e => { setSelectedScopeEntity(e.target.value); setError(''); }}>
                                    <option value="">Choose case...</option>
                                    {cases.map(c => <option key={c.public_id} value={c.public_id}>{c.title}</option>)}
                                </select>
                            </Field>
                        )}
                        <Field label="Select Permissions">
                            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--rule)', padding: 8, background: 'rgba(0,0,0,0.1)' }}>
                                {allPermissions.length === 0 ? (
                                    <div style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'center' }}>No permissions loaded</div>
                                ) : (
                                    allPermissions.map(p => (
                                        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }} onClick={() => togglePermission(p.name)}>
                                            <input type="checkbox" checked={selectedPermissions.includes(p.name)} onChange={() => { }} />
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: 11, fontWeight: 500, fontFamily: 'var(--mono)' }}>{p.name}</span>
                                                {p.description && <span style={{ fontSize: 9, color: 'var(--ink3)' }}>{p.description}</span>}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Field>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} disabled={creating}>
                            {creating ? 'Creating...' : 'Create Role'}
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

    const currentPage = page || 'overview';

    const refresh = async () => {
        try {
            const list = await getCases();
            setCases(list || []);

            // Fetch evidence for each case in parallel to sum up
            const evPromises = (list || []).map(c => getEvidence(c.public_id).catch(() => []));
            const evResults = await Promise.all(evPromises);
            const allEv = evResults.flat();
            setEvidence(allEv);
        } catch { }
    };

    useEffect(() => { refresh(); }, []);

    const pages = {
        overview: <Overview cases={cases} evidence={evidence} />,
        cases: <Cases cases={cases} onRefresh={refresh} />,
        departments: <Departments />,
        roles: <Roles cases={cases} />,
        members: <Members onRefresh={refresh} />,
        audit: <Audit />,
    };

    return (
        <AppLayout navItems={NAV} activePage={currentPage} onNavigate={(id) => navigate(`/admin/${id}`)}>
            {pages[currentPage] || pages.overview}
        </AppLayout>
    );
}

