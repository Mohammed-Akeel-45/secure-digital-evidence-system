import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    getCaseById, 
    getCaseUsers, 
    updateCaseStatus, 
    deleteCase, 
    assignUserToCase, 
    removeUserFromCase,
    getOrgUsers 
} from '../../api/auth';
import { SectionTitle, Empty, Badge } from './AdminCommon';
import { EvidenceSection } from './Cases';
import { ErrorBanner, SuccessBanner, Field } from '../auth/FormParts';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'CLOSED', 'ARCHIVED'];

export function CaseDetails({ isUserView = false }) {
    const { id } = useParams();
    const navigate = useNavigate();

    const [caseData, setCaseData] = useState(null);
    const [caseUsers, setCaseUsers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [selectedUserToAssign, setSelectedUserToAssign] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [assigningUser, setAssigningUser] = useState(false);
    const [deletingCase, setDeletingCase] = useState(false);

    const loadCaseData = async () => {
        setLoading(true);
        setError('');
        try {
            const details = await getCaseById(id);
            setCaseData(details);

            const users = await getCaseUsers(id);
            setCaseUsers(users || []);

            if (!isUserView) {
                const orgUsers = await getOrgUsers().catch(() => []);
                setAllUsers(Array.isArray(orgUsers) ? orgUsers : []);
            }
        } catch (err) {
            setError(err.message?.toUpperCase() || 'FAILED TO LOAD CASE DETAILS');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            loadCaseData();
        }
    }, [id]);

    const handleStatusChange = async (newStatus) => {
        setUpdatingStatus(true);
        setError('');
        setSuccess('');
        try {
            await updateCaseStatus({ caseId: id, status: newStatus.toLowerCase() });
            setCaseData(c => ({ ...c, status: newStatus }));
            setSuccess(`CASE STATUS UPDATED TO ${newStatus}`);
        } catch (err) {
            setError(err.message?.toUpperCase() || 'FAILED TO UPDATE CASE STATUS');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleAssignUser = async (e) => {
        e.preventDefault();
        if (!selectedUserToAssign) return;
        setAssigningUser(true);
        setError('');
        setSuccess('');
        try {
            await assignUserToCase({ caseId: id, userId: selectedUserToAssign });
            const assigned = allUsers.find(u => u.public_id === selectedUserToAssign);
            setSuccess(`USER ${assigned?.name || selectedUserToAssign} ASSIGNED TO CASE`);
            setSelectedUserToAssign('');
            const updatedUsers = await getCaseUsers(id);
            setCaseUsers(updatedUsers || []);
        } catch (err) {
            setError(err.message?.toUpperCase() || 'FAILED TO ASSIGN USER');
        } finally {
            setAssigningUser(false);
        }
    };

    const handleRemoveUser = async (userId, userName) => {
        if (!window.confirm(`Remove ${userName || 'user'} from this case?`)) return;
        setError('');
        setSuccess('');
        try {
            await removeUserFromCase({ caseId: id, userId });
            setSuccess(`USER ${userName || ''} REMOVED FROM CASE`);
            setCaseUsers(users => users.filter(u => u.public_id !== userId));
        } catch (err) {
            setError(err.message?.toUpperCase() || 'FAILED TO REMOVE USER');
        }
    };

    const handleDeleteCase = async () => {
        if (!window.confirm(`Are you sure you want to permanently delete case "${caseData.title}"? This cannot be undone.`)) return;
        setDeletingCase(true);
        setError('');
        try {
            await deleteCase(id);
            navigate('/admin/cases');
        } catch (err) {
            setError(err.message?.toUpperCase() || 'FAILED TO DELETE CASE');
            setDeletingCase(false);
        }
    };

    const backUrl = isUserView ? '/dashboard/cases' : '/admin/cases';

    if (loading) {
        return (
            <div className="animate-slide">
                <div className="page-title">Case Details</div>
                <Empty>Loading case details from secure ledger...</Empty>
            </div>
        );
    }

    if (!caseData) {
        return (
            <div className="animate-slide">
                <div className="page-title">Case Details</div>
                <ErrorBanner message={error || 'Case not found'} />
                <button className="btn" onClick={() => navigate(backUrl)} style={{ marginTop: 12 }}>
                    ← Back to Cases
                </button>
            </div>
        );
    }

    // Filter available users to assign (exclude already assigned)
    const availableUsers = allUsers.filter(u => !caseUsers.some(cu => cu.public_id === u.public_id));

    return (
        <div className="animate-slide">
            {/* Header with back button, title, priority, status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => navigate(backUrl)} style={{ padding: '6px 12px', fontSize: 11 }}>
                    ← Back
                </button>
                <div className="page-title" style={{ margin: 0, flex: 1 }}>{caseData.title}</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>PRIORITY:</span>
                    <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        fontFamily: 'var(--mono)',
                        fontSize: 9,
                        background: caseData.priority === 'high' ? 'rgba(255,60,60,0.1)' : 'rgba(255,255,255,0.06)',
                        color: caseData.priority === 'high' ? '#ff4444' : '#ccc',
                        textTransform: 'uppercase'
                    }}>{caseData.priority || 'NORMAL'}</span>
                    <Badge status={caseData.status} />

                    {/* Admin Status Lifecycle Selector */}
                    {!isUserView && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>STATE:</span>
                            <select
                                className="select"
                                value={caseData.status?.toUpperCase() || 'OPEN'}
                                onChange={(e) => handleStatusChange(e.target.value)}
                                disabled={updatingStatus}
                                style={{ height: 28, fontSize: 10, padding: '2px 20px 2px 8px' }}
                            >
                                {STATUSES.map(st => (
                                    <option key={st} value={st}>{st}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {!isUserView && (
                        <button
                            className="btn btn-danger"
                            onClick={handleDeleteCase}
                            disabled={deletingCase}
                            style={{ fontSize: 9, padding: '4px 10px' }}
                        >
                            {deletingCase ? 'Deleting...' : 'Delete Case'}
                        </button>
                    )}
                </div>
            </div>

            <div className="page-sub">Case File • {caseData.public_id} • Created: {new Date(caseData.created_at || Date.now()).toLocaleDateString('en-IN')}</div>

            <ErrorBanner message={error} />
            <SuccessBanner message={success} />

            {/* Case Overview & Assigned Investigators */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 20 }}>
                <div className="card">
                    <SectionTitle>Case Scope & Description</SectionTitle>
                    <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
                        {caseData.description || <span style={{ fontStyle: 'italic', color: 'var(--ink3)' }}>No case brief provided.</span>}
                    </div>

                    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--rule2)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                        <div>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 2 }}>Case ID</div>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink)' }}>{caseData.public_id}</div>
                        </div>
                        {caseData.dept_id && (
                            <div>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 2 }}>Department ID</div>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink)' }}>{caseData.dept_id}</div>
                            </div>
                        )}
                        <div>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 2 }}>Status</div>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink)' }}>{caseData.status || 'OPEN'}</div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <SectionTitle>Assigned Team ({caseUsers.length})</SectionTitle>
                    {caseUsers.length === 0 ? (
                        <Empty>No officers or investigators assigned to this case.</Empty>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                            {caseUsers.map(u => (
                                <div key={u.public_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--rule2)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                        <div style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: '50%',
                                            background: 'var(--rule)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontFamily: 'var(--mono)',
                                            fontSize: 9,
                                            color: 'var(--ink)',
                                            flexShrink: 0
                                        }}>
                                            {u.name ? u.name[0].toUpperCase() : 'U'}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {u.name}
                                            </div>
                                            {u.email && (
                                                <div style={{ fontSize: 10, color: 'var(--ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {u.email}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {!isUserView && (
                                        <button
                                            className="btn btn-danger"
                                            onClick={() => handleRemoveUser(u.public_id, u.name)}
                                            style={{ fontSize: 8, padding: '2px 6px' }}
                                            title="Unassign user from case"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Admin Assign User Form */}
                    {!isUserView && (
                        <form onSubmit={handleAssignUser} style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--rule2)' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <select
                                    className="select"
                                    value={selectedUserToAssign}
                                    onChange={(e) => setSelectedUserToAssign(e.target.value)}
                                    style={{ flex: 1, height: 30, fontSize: 10 }}
                                >
                                    <option value="">Assign officer...</option>
                                    {availableUsers.map(u => (
                                        <option key={u.public_id} value={u.public_id}>
                                            {u.name} ({u.email || u.public_id.slice(0, 6)})
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={!selectedUserToAssign || assigningUser}
                                    style={{ fontSize: 9, padding: '4px 10px' }}
                                >
                                    {assigningUser ? '...' : 'Assign'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* Evidence Section */}
            <div className="card">
                <SectionTitle>Case Evidence Repository</SectionTitle>
                <EvidenceSection caseId={caseData.public_id} />
            </div>
        </div>
    );
}
