import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCases, getEvidence, uploadEvidence, downloadEvidence, verifyEvidence } from '../../api/auth';
import { Badge, Empty, SectionTitle, computeSHA256, formatFileSize, StatCard } from '../admin/AdminCommon';
import { Field, ErrorBanner, SuccessBanner } from '../auth/FormParts';
import { useAuth } from '../../context/AuthContext';

const EVIDENCE_TYPES = ['Document', 'Image', 'Video', 'Audio', 'Archive', 'Other'];

export function EvidenceVault({ initialCaseId = null, title = 'Evidence Vault', subtitle = 'Cryptographically verified evidence storage & integrity audit ledger' }) {
    const { isAdmin } = useAuth();
    const navigate = useNavigate();
    const fileRef = useRef();

    const [cases, setCases] = useState([]);
    const [selectedCaseId, setSelectedCaseId] = useState(initialCaseId || '');
    const [evidence, setEvidence] = useState([]);
    const [loading, setLoading] = useState(true);

    // Upload Form state
    const [dragging, setDragging] = useState(false);
    const [file, setFile] = useState(null);
    const [hash, setHash] = useState('');
    const [hashing, setHashing] = useState(false);
    const [form, setForm] = useState({ type: 'Document', description: '', targetCaseId: initialCaseId || '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [uploading, setUploading] = useState(false);
    const [verifyingId, setVerifyingId] = useState(null);

    // Search and filter
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('ALL');

    // Load cases for dropdown
    useEffect(() => {
        getCases()
            .then(res => {
                const list = Array.isArray(res) ? res : [];
                setCases(list);
                if (!form.targetCaseId && list.length > 0) {
                    setForm(f => ({ ...f, targetCaseId: list[0].public_id }));
                }
            })
            .catch(() => setCases([]));
    }, []);

    // Load evidence
    const loadAllEvidence = async () => {
        setLoading(true);
        setError('');
        try {
            if (selectedCaseId) {
                const list = await getEvidence(selectedCaseId);
                setEvidence(Array.isArray(list) ? list : []);
            } else {
                const caseList = cases.length > 0 ? cases : await getCases().catch(() => []);
                const promises = caseList.map(c => 
                    getEvidence(c.public_id)
                        .then(items => Array.isArray(items) ? items.map(item => ({ ...item, case_title: c.title, case_id: c.public_id })) : [])
                        .catch(() => [])
                );
                const results = await Promise.all(promises);
                setEvidence(results.flat());
            }
        } catch (err) {
            setError(err.message || 'Failed to load evidence');
            setEvidence([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAllEvidence();
    }, [selectedCaseId, cases.length]);

    const handleFile = async (f) => {
        if (!f) return;
        setFile(f);
        setHash('');
        setSuccess('');
        setError('');
        setHashing(true);
        try {
            const h = await computeSHA256(f);
            setHash(h);
        } catch (err) {
            setError('Failed to compute file SHA-256: ' + err.message);
        } finally {
            setHashing(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        const targetCase = form.targetCaseId || selectedCaseId;
        if (!targetCase) {
            setError('PLEASE SELECT A CASE FOR THIS EVIDENCE');
            return;
        }
        if (!file) {
            setError('NO FILE SELECTED');
            return;
        }

        setError('');
        setSuccess('');
        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('case_id', targetCase);
            formData.append('type', form.type);
            formData.append('description', form.description);

            await uploadEvidence(formData);
            setSuccess(`EVIDENCE "${file.name}" STORED & REGISTERED SUCCESSFULLY`);
            setFile(null);
            setHash('');
            setForm(f => ({ ...f, description: '' }));
            if (fileRef.current) fileRef.current.value = '';
            await loadAllEvidence();
        } catch (err) {
            setError(err.message?.toUpperCase() || 'UPLOAD FAILED');
        } finally {
            setUploading(false);
        }
    };

    const handleVerify = async (ev) => {
        const id = ev.public_id || ev.id;
        setVerifyingId(id);
        setError('');
        setSuccess('');
        try {
            const res = await verifyEvidence(id);
            const isValid = res.status === 'VALID' || res.status === 'VERIFIED';
            setEvidence(items => items.map(item => {
                if ((item.public_id || item.id) === id) {
                    return {
                        ...item,
                        integrityStatus: isValid ? 'VALID' : 'TAMPERED',
                        lastChecked: new Date().toISOString(),
                    };
                }
                return item;
            }));

            if (isValid) {
                setSuccess(`EVIDENCE "${ev.file_name}" INTEGRITY CONFIRMED (SHA-256 MATCHES LEDGER)`);
            } else {
                setError(`INTEGRITY ALERT: "${ev.file_name}" MAY BE COMPROMISED (${res.message || 'HASH MISMATCH'})`);
            }
        } catch (err) {
            setError('VERIFICATION FAILED: ' + (err.message || '').toUpperCase());
        } finally {
            setVerifyingId(null);
        }
    };

    const handleDownload = async (ev) => {
        setError('');
        try {
            const blob = await downloadEvidence(ev.public_id || ev.id);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', ev.file_name || 'evidence_file');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError('DOWNLOAD FAILED: ' + err.message?.toUpperCase());
        }
    };

    const filteredEvidence = evidence.filter(ev => {
        if (filterType !== 'ALL' && ev.type?.toUpperCase() !== filterType) return false;
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            const nameMatch = ev.file_name?.toLowerCase().includes(term);
            const hashMatch = ev.current_hash?.toLowerCase().includes(term);
            const idMatch = ev.public_id?.toLowerCase().includes(term);
            const descMatch = ev.description?.toLowerCase().includes(term);
            if (!nameMatch && !hashMatch && !idMatch && !descMatch) return false;
        }
        return true;
    });

    const verifiedCount = evidence.filter(e => (e.integrityStatus || 'VALID') === 'VALID' || (e.integrityStatus || 'VALID') === 'VERIFIED').length;
    const tamperedCount = evidence.filter(e => e.integrityStatus === 'TAMPERED' || e.integrityStatus === 'FLAGGED').length;

    return (
        <div className="animate-slide">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                    <div className="page-title">{title}</div>
                    <div className="page-sub">{subtitle}</div>
                </div>
                <button className="btn" onClick={loadAllEvidence} disabled={loading} style={{ fontSize: 10, padding: '6px 14px' }}>
                    {loading ? 'Refreshing...' : 'Refresh Vault'}
                </button>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                <StatCard value={evidence.length} label="Total Evidence Items" />
                <StatCard value={cases.length} label="Active Cases" />
                <StatCard value={verifiedCount} label="Verified Untampered" />
                {tamperedCount > 0 && <StatCard value={tamperedCount} label="Integrity Alerts" />}
            </div>

            {/* Filter & Search Bar */}
            <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 200 }}>
                        <select
                            className="select"
                            value={selectedCaseId}
                            onChange={(e) => setSelectedCaseId(e.target.value)}
                            style={{ height: 32, fontSize: 11 }}
                        >
                            <option value="">All Accessible Cases</option>
                            {cases.map(c => (
                                <option key={c.public_id} value={c.public_id}>
                                    Case: {c.title} ({c.public_id?.slice(0, 6)}...)
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ flex: 1, minWidth: 220 }}>
                        <input
                            type="text"
                            placeholder="Search by file name, SHA-256 hash, ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input"
                            style={{ height: 32, fontSize: 11, fontFamily: 'var(--mono)' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {['ALL', 'DOCUMENT', 'IMAGE', 'VIDEO', 'ARCHIVE'].map(t => (
                            <button
                                key={t}
                                onClick={() => setFilterType(t)}
                                className="btn"
                                style={{
                                    fontSize: 9,
                                    padding: '4px 8px',
                                    background: filterType === t ? 'rgba(255,255,255,0.12)' : 'transparent',
                                    border: `1px solid ${filterType === t ? 'var(--ink)' : 'var(--rule2)'}`
                                }}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <ErrorBanner message={error} />
            <SuccessBanner message={success} />

            {/* Main Layout Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
                <div className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--rule2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <SectionTitle style={{ margin: 0, border: 'none', padding: 0 }}>
                            Evidence Ledger ({filteredEvidence.length} Files)
                        </SectionTitle>
                        {selectedCaseId && (
                            <button className="btn" onClick={() => setSelectedCaseId('')} style={{ fontSize: 9, padding: '2px 8px' }}>
                                View All Cases
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <Empty>Querying encrypted evidence vault...</Empty>
                    ) : filteredEvidence.length === 0 ? (
                        <Empty>No evidence records found matching the criteria.</Empty>
                    ) : (
                        <div>
                            {filteredEvidence.map(ev => {
                                const fileExt = ev.file_name?.split('.').pop()?.toUpperCase() || 'BIN';
                                const itemCaseTitle = ev.case_title || cases.find(c => c.public_id === ev.case_id)?.title;
                                const status = ev.integrityStatus || 'VALID';

                                return (
                                    <div key={ev.public_id || ev.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule2)' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                            <div style={{
                                                width: 42,
                                                height: 42,
                                                background: 'var(--rule2)',
                                                border: '1px solid var(--rule)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                fontFamily: 'var(--mono)',
                                                fontSize: 9,
                                                fontWeight: 700,
                                                color: 'var(--ink)'
                                            }}>
                                                <span>{fileExt.slice(0, 4)}</span>
                                            </div>

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', wordBreak: 'break-all' }}>
                                                        {ev.file_name}
                                                    </span>
                                                    <Badge status={status} />
                                                    {ev.type && (
                                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', background: 'rgba(255,255,255,0.04)', padding: '1px 6px' }}>
                                                            {ev.type}
                                                        </span>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8, fontSize: 11, color: 'var(--ink3)' }}>
                                                    <span>Size: <strong style={{ color: 'var(--ink2)' }}>{formatFileSize(ev.file_size)}</strong></span>
                                                    {itemCaseTitle && (
                                                        <span>Case: <strong style={{ color: 'var(--ink2)' }}>{itemCaseTitle}</strong></span>
                                                    )}
                                                    <span>Uploaded: {new Date(ev.uploaded_at || ev.created_at || Date.now()).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                                </div>

                                                {ev.description && (
                                                    <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8, fontStyle: 'italic' }}>
                                                        "{ev.description}"
                                                    </div>
                                                )}

                                                <div style={{ padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--rule2)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)', letterSpacing: '0.08em' }}>SHA-256 DIGEST</span>
                                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)' }}>ID: {ev.public_id || ev.id}</span>
                                                    </div>
                                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: status === 'TAMPERED' ? '#ff4444' : '#00c878', wordBreak: 'break-all', lineHeight: 1.4 }}>
                                                        {ev.current_hash || 'No hash recorded'}
                                                    </div>
                                                </div>

                                                {ev.lastChecked && (
                                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginTop: 6 }}>
                                                        Last checked against ledger: {new Date(ev.lastChecked).toLocaleTimeString('en-IN')}
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <button
                                                    className="btn"
                                                    style={{ fontSize: 9, padding: '5px 12px' }}
                                                    onClick={() => handleDownload(ev)}
                                                >
                                                    Download
                                                </button>
                                                <button
                                                    className="btn"
                                                    style={{ fontSize: 9, padding: '5px 12px' }}
                                                    onClick={() => handleVerify(ev)}
                                                    disabled={verifyingId === (ev.public_id || ev.id)}
                                                >
                                                    {verifyingId === (ev.public_id || ev.id) ? 'Verifying...' : 'Verify Hash'}
                                                </button>
                                                <button
                                                    className="btn"
                                                    style={{ fontSize: 9, padding: '5px 12px', color: 'var(--ink3)' }}
                                                    onClick={() => {
                                                        const base = isAdmin ? '/admin' : '/dashboard';
                                                        navigate(`${base}/custody?evidence_id=${ev.public_id || ev.id}`);
                                                    }}
                                                >
                                                    Custody Trail
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="card">
                        <SectionTitle>Upload & Register Evidence</SectionTitle>
                        <form onSubmit={handleUploadSubmit}>
                            <Field label="Assign To Case">
                                <select
                                    className="select"
                                    value={form.targetCaseId || selectedCaseId}
                                    onChange={e => setForm(f => ({ ...f, targetCaseId: e.target.value }))}
                                    required
                                >
                                    <option value="">Select Target Case...</option>
                                    {cases.map(c => (
                                        <option key={c.public_id} value={c.public_id}>
                                            {c.title} ({c.public_id?.slice(0, 6)}...)
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <div
                                style={{
                                    border: `1px dashed ${dragging ? 'var(--ink2)' : 'var(--rule)'}`,
                                    padding: '24px 16px',
                                    textAlign: 'center',
                                    marginBottom: 14,
                                    cursor: 'pointer',
                                    background: dragging ? 'rgba(255,255,255,0.02)' : 'transparent',
                                    transition: 'all 0.15s ease'
                                }}
                                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileRef.current && fileRef.current.click()}
                            >
                                <input
                                    ref={fileRef}
                                    type="file"
                                    style={{ display: 'none' }}
                                    onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
                                />
                                {file ? (
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, wordBreak: 'break-all' }}>{file.name}</div>
                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>{formatFileSize(file.size)}</div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 4 }}>Drag & drop file or click to browse</div>
                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>SHA-256 generated client-side before upload</div>
                                    </div>
                                )}
                            </div>

                            {(hashing || hash) && (
                                <div style={{ padding: '8px 10px', background: 'var(--surface2)', border: '1px solid var(--rule2)', marginBottom: 14 }}>
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)', marginBottom: 4, letterSpacing: '0.08em' }}>COMPUTED CLIENT SHA-256</div>
                                    {hashing
                                        ? <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>Computing checksum...</div>
                                        : <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: '#00c878', wordBreak: 'break-all', lineHeight: 1.4 }}>{hash}</div>}
                                </div>
                            )}

                            <Field label="Evidence Classification">
                                <select
                                    className="select"
                                    value={form.type}
                                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                >
                                    {EVIDENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </Field>

                            <Field label="Description & Notes">
                                <textarea
                                    className="input"
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Chain of custody provenance, collection details..."
                                    style={{ height: 68, resize: 'none' }}
                                />
                            </Field>

                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{ width: '100%', marginTop: 4 }}
                                disabled={uploading || hashing || !file}
                            >
                                {uploading ? 'Registering & Uploading...' : 'Securely Ingest Evidence'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
