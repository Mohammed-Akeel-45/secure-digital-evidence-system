import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCustodyLogById } from '../../api/auth';
import { SectionTitle, Empty, Badge, formatFileSize } from './AdminCommon';
import { ErrorBanner } from '../auth/FormParts';

export function CustodyLogDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [logData, setLogData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadLog = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getCustodyLogById(id);
            setLogData(data);
        } catch (err) {
            setError(err.message || 'Custody log record not found');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            loadLog();
        }
    }, [id]);

    if (loading) {
        return (
            <div className="animate-slide">
                <div className="page-title">Custody Transfer Record</div>
                <Empty>Loading custody record details...</Empty>
            </div>
        );
    }

    if (!logData) {
        return (
            <div className="animate-slide">
                <div className="page-title">Custody Transfer Record</div>
                <ErrorBanner message={error || 'Custody record not found'} />
                <button className="btn" onClick={() => navigate('/admin/custody')} style={{ marginTop: 12 }}>
                    ← Back to Chain of Custody
                </button>
            </div>
        );
    }

    return (
        <div className="animate-slide">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <button className="btn" onClick={() => navigate('/admin/custody')} style={{ padding: '6px 12px', fontSize: 11 }}>
                    ← Back
                </button>
                <div className="page-title" style={{ margin: 0 }}>Custody Event Record</div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Badge status={logData.action} />
                </div>
            </div>
            <div className="page-sub">Chain-of-Custody Entry • {logData.public_id}</div>

            {/* Event Summary & Action */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
                <div className="card">
                    <SectionTitle>Custody Action & Remarks</SectionTitle>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--rule2)', paddingBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>ACTION TYPE:</span>
                            <Badge status={logData.action} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--rule2)', paddingBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>TIMESTAMP:</span>
                            <span>{new Date(logData.timestamp).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'long' })}</span>
                        </div>
                        <div style={{ marginTop: 4 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', display: 'block', marginBottom: 4 }}>OFFICIAL REMARKS:</span>
                            <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--rule2)', borderRadius: 2, fontSize: 13, color: 'var(--ink)' }}>
                                {logData.remarks || 'No remarks recorded.'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <SectionTitle>Target Evidence & Case</SectionTitle>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--rule2)', paddingBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>EVIDENCE NAME:</span>
                            <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent)' }}>
                                {logData.evidence_name || logData.action_metadata?.file_name || 'Evidence Item'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--rule2)', paddingBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>EVIDENCE PUBLIC UUID:</span>
                            <span style={{ fontFamily: 'var(--mono)' }}>{logData.evidence_public_id || '-'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--rule2)', paddingBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>CASE TITLE:</span>
                            <span style={{ fontFamily: 'var(--mono)', fontWeight: 500 }}>
                                {logData.case_title || logData.action_metadata?.case_title || '-'}
                            </span>
                        </div>
                        {logData.case_public_id && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--rule2)', paddingBottom: 6 }}>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>CASE UUID:</span>
                                <span style={{ fontFamily: 'var(--mono)' }}>{logData.case_public_id}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--rule2)', paddingBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>RESPONSIBLE USER:</span>
                            <span style={{ fontFamily: 'var(--mono)', fontWeight: 500 }}>
                                {logData.user_name || logData.action_metadata?.user_name || 'User'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Metadata JSON */}
            {logData.action_metadata && Object.keys(logData.action_metadata).length > 0 && (
                <div className="card">
                    <SectionTitle>Action Metadata Attributes</SectionTitle>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12, fontFamily: 'var(--mono)', fontSize: 11 }}>
                        {logData.action_metadata.file_name && <div><span style={{ color: 'var(--ink3)' }}>FILE: </span>{logData.action_metadata.file_name}</div>}
                        {logData.action_metadata.file_size && <div><span style={{ color: 'var(--ink3)' }}>SIZE: </span>{formatFileSize(logData.action_metadata.file_size)}</div>}
                        {logData.action_metadata.case_title && <div><span style={{ color: 'var(--ink3)' }}>CASE: </span>{logData.action_metadata.case_title}</div>}
                        {logData.action_metadata.user_name && <div><span style={{ color: 'var(--ink3)' }}>USER: </span>{logData.action_metadata.user_name}</div>}
                    </div>
                    <pre style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)', background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 2, margin: 0, overflowX: 'auto' }}>
                        {JSON.stringify(logData.action_metadata, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
