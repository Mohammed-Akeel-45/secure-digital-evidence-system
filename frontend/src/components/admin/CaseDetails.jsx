import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCaseById, getCaseUsers } from '../../api/auth';
import { SectionTitle, Empty, Badge } from './AdminCommon';
import { EvidenceSection } from './Cases';
import { ErrorBanner } from '../auth/FormParts';

export function CaseDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [caseData, setCaseData] = useState(null);
    const [caseUsers, setCaseUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadCaseData = async () => {
        setLoading(true);
        setError('');
        try {
            const details = await getCaseById(id);
            setCaseData(details);

            const users = await getCaseUsers(id);
            setCaseUsers(users || []);
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            loadCaseData();
        }
    }, [id]);

    if (loading) {
        return (
            <div className="animate-slide">
                <div className="page-title">Case Details</div>
                <Empty>Loading case details...</Empty>
            </div>
        );
    }

    if (!caseData) {
        return (
            <div className="animate-slide">
                <div className="page-title">Case Details</div>
                <ErrorBanner message={error || 'Case not found'} />
                <button className="btn" onClick={() => navigate('/admin/cases')} style={{ marginTop: 12 }}>
                    ← Back to Case Management
                </button>
            </div>
        );
    }

    return (
        <div className="animate-slide">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <button className="btn" onClick={() => navigate('/admin/cases')} style={{ padding: '6px 12px', fontSize: 11 }}>
                    ← Back
                </button>
                <div className="page-title" style={{ margin: 0 }}>{caseData.title}</div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>PRIORITY:</span>
                    <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        fontFamily: 'var(--mono)',
                        fontSize: 9,
                        background: caseData.priority === 'high' ? 'rgba(255,60,60,0.1)' : 'rgba(255,255,255,0.06)',
                        color: caseData.priority === 'high' ? '#ff4444' : '#ccc',
                        textTransform: 'uppercase'
                    }}>{caseData.priority}</span>
                    <Badge status={caseData.status} />
                </div>
            </div>
            <div className="page-sub">Case File • {caseData.public_id}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginBottom: 20 }}>
                <div className="card">
                    <SectionTitle>Description</SectionTitle>
                    <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
                        {caseData.description || <span style={{ fontStyle: 'italic', color: 'var(--ink3)' }}>No description provided.</span>}
                    </div>
                </div>
                <div className="card">
                    <SectionTitle>Assigned Users ({caseUsers.length})</SectionTitle>
                    {caseUsers.length === 0 ? (
                        <Empty>No users assigned to this case.</Empty>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {caseUsers.map(u => (
                                <div key={u.public_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--rule2)' }}>
                                    <div style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: '50%',
                                        background: 'var(--rule)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontFamily: 'var(--mono)',
                                        fontSize: 9,
                                        color: 'var(--ink2)',
                                        flexShrink: 0
                                    }}>
                                        {u.name[0].toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {u.name}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="card">
                <SectionTitle>Evidence Vault</SectionTitle>
                <EvidenceSection caseId={caseData.public_id} />
            </div>
        </div>
    );
}
