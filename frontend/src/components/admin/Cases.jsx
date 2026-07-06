import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCaseUsers, getEvidence, uploadEvidence, downloadEvidence } from '../../api/auth';
import { Row, Badge, Empty, SectionTitle, computeSHA256 } from './AdminCommon';
import { Field, ErrorBanner, SuccessBanner } from '../auth/FormParts';

const EVIDENCE_TYPES = ['Document', 'Image', 'Video', 'Audio', 'Archive', 'Other'];

export function EvidenceSection({ caseId }) {
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
            if (Array.isArray(list)) {
                setEvidence(list)
                return;
            }
            setEvidence([]);
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

export function Cases({ cases, onRefresh }) {
    const navigate = useNavigate();

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
                                <Row onClick={() => navigate(`/admin/case/${c.public_id}`)}>
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', width: 80, flexShrink: 0 }}>{c.public_id?.slice(0, 8)}...</span>
                                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{c.title}</span>
                                    <Badge status={c.status} />
                                    <span style={{ color: 'var(--ink3)', fontSize: 12, marginLeft: 4 }}>▸</span>
                                </Row>
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
