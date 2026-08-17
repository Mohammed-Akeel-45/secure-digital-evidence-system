import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAuditLogById } from '../../api/auth';
import { SectionTitle, Empty, Badge, formatFileSize } from './AdminCommon';
import { ErrorBanner } from '../auth/FormParts';

export function AuditLogDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [logData, setLogData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copiedField, setCopiedField] = useState('');

    const loadLog = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getAuditLogById(id);
            setLogData(data);
        } catch (err) {
            setError(err.message || 'Audit log not found');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            loadLog();
        }
    }, [id]);

    const copyToClipboard = (text, fieldName) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(''), 2000);
    };

    if (loading) {
        return (
            <div className="animate-slide">
                <div className="page-title">Audit Record Details</div>
                <Empty>Verifying and loading cryptographic audit record...</Empty>
            </div>
        );
    }

    if (!logData) {
        return (
            <div className="animate-slide">
                <div className="page-title">Audit Record Details</div>
                <ErrorBanner message={error || 'Audit record not found'} />
                <button className="btn" onClick={() => navigate('/admin/audit')} style={{ marginTop: 12 }}>
                    ← Back to Audit Logs
                </button>
            </div>
        );
    }

    const isTampered = logData.status?.toUpperCase() === 'TAMPERED';

    return (
        <div className="animate-slide">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <button className="btn" onClick={() => navigate('/admin/audit')} style={{ padding: '6px 12px', fontSize: 11 }}>
                    ← Back
                </button>
                <div className="page-title" style={{ margin: 0 }}>Audit Record</div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Badge status={logData.action} />
                    <Badge status={logData.status?.toUpperCase() || 'UNCHANGED'} />
                </div>
            </div>
            <div className="page-sub">Cryptographic Ledger Entry • {logData.public_id}</div>

            {/* Cryptographic Hash Chain Card */}
            <div className="card" style={{ marginBottom: 16 }}>
                <SectionTitle>Cryptographic Hash Chain</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center' }}>
                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px 16px', border: '1px solid var(--rule2)', borderRadius: 2 }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 6 }}>
                            Previous Block Hash
                        </div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: logData.previous_hash ? 'var(--ink)' : 'var(--ink3)', wordBreak: 'break-all' }}>
                            {logData.previous_hash || '0000000000000000000000000000000000000000000000000000000000000000 (Genesis Entry)'}
                        </div>
                        {logData.previous_hash && (
                            <button
                                className="btn"
                                onClick={() => copyToClipboard(logData.previous_hash, 'prev')}
                                style={{ fontSize: 8, padding: '2px 8px', marginTop: 8 }}
                            >
                                {copiedField === 'prev' ? 'Copied!' : 'Copy Hash'}
                            </button>
                        )}
                    </div>

                    <div style={{ fontSize: 20, color: 'var(--ink3)' }}>&rarr;</div>

                    <div style={{ background: isTampered ? 'rgba(255,60,60,0.06)' : 'rgba(0,200,120,0.06)', padding: '12px 16px', border: `1px solid ${isTampered ? '#ff4444' : 'rgba(0,200,120,0.3)'}`, borderRadius: 2 }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: isTampered ? '#ff6666' : '#00c878', textTransform: 'uppercase', marginBottom: 6 }}>
                            Current Chained Hash ({logData.status?.toUpperCase() || 'UNCHANGED'})
                        </div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: isTampered ? '#ff6666' : '#00c878', wordBreak: 'break-all', fontWeight: 600 }}>
                            {logData.current_hash}
                        </div>
                        <button
                            className="btn"
                            onClick={() => copyToClipboard(logData.current_hash, 'curr')}
                            style={{ fontSize: 8, padding: '2px 8px', marginTop: 8 }}
                        >
                            {copiedField === 'curr' ? 'Copied!' : 'Copy Hash'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Event Metadata & Association */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
                <div className="card">
                    <SectionTitle>Event & Origin Details</SectionTitle>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--rule2)', paddingBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>SERVICE NAME:</span>
                            <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{logData.service_name}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--rule2)', paddingBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>CLIENT IP ADDRESS:</span>
                            <span style={{ fontFamily: 'var(--mono)' }}>{logData.ip_address || '-'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--rule2)', paddingBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>REQUEST ID (IDEMPOTENCY):</span>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{logData.request_id || '-'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--rule2)', paddingBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>RECORDED AT:</span>
                            <span>{new Date(logData.created_at).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'long' })}</span>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <SectionTitle>Target Evidence & Case</SectionTitle>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--rule2)', paddingBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>EVIDENCE NAME:</span>
                            <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent)' }}>
                                {logData.evidence_name || logData.details?.file_name || 'Evidence Item'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--rule2)', paddingBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>EVIDENCE PUBLIC UUID:</span>
                            <span style={{ fontFamily: 'var(--mono)' }}>{logData.evidence_public_id || '-'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--rule2)', paddingBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>CASE TITLE:</span>
                            <span style={{ fontFamily: 'var(--mono)', fontWeight: 500 }}>
                                {logData.case_title || logData.details?.case_title || '-'}
                            </span>
                        </div>
                        {logData.case_public_id && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--rule2)', paddingBottom: 6 }}>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>CASE UUID:</span>
                                <span style={{ fontFamily: 'var(--mono)' }}>{logData.case_public_id}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--rule2)', paddingBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>ACTOR NAME:</span>
                            <span style={{ fontFamily: 'var(--mono)', fontWeight: 500 }}>
                                {logData.user_name || logData.details?.user_name || 'User'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Extra Details JSON */}
            {logData.details && Object.keys(logData.details).length > 0 && (
                <div className="card">
                    <SectionTitle>Audit Event Details</SectionTitle>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12, fontFamily: 'var(--mono)', fontSize: 11 }}>
                        {logData.details.file_name && <div><span style={{ color: 'var(--ink3)' }}>FILE: </span>{logData.details.file_name}</div>}
                        {logData.details.file_size && <div><span style={{ color: 'var(--ink3)' }}>SIZE: </span>{formatFileSize(logData.details.file_size)}</div>}
                        {logData.details.case_title && <div><span style={{ color: 'var(--ink3)' }}>CASE: </span>{logData.details.case_title}</div>}
                        {logData.details.user_name && <div><span style={{ color: 'var(--ink3)' }}>USER: </span>{logData.details.user_name}</div>}
                    </div>
                    <pre style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)', background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 2, margin: 0, overflowX: 'auto' }}>
                        {JSON.stringify(logData.details, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
