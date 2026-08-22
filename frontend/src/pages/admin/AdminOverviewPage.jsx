import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { getCases, getEvidence, getOrgUsers, getOrgDepartments, getAuditLogs } from '../../api/auth';
import { StatCard, SectionTitle, Empty, Row, Badge } from '../../components/admin/AdminCommon';

export function AdminOverviewPage() {
    const navigate = useNavigate();
    const [cases, setCases] = useState([]);
    const [evidence, setEvidence] = useState([]);
    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [recentLogs, setRecentLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadOverviewData = async () => {
            setLoading(true);
            try {
                const [casesRes, usersRes, deptsRes, logsRes] = await Promise.all([
                    getCases().catch(() => []),
                    getOrgUsers().catch(() => []),
                    getOrgDepartments().catch(() => []),
                    getAuditLogs().catch(() => []),
                ]);

                const casesList = Array.isArray(casesRes) ? casesRes : [];
                setCases(casesList);
                setUsers(Array.isArray(usersRes) ? usersRes : []);
                setDepartments(Array.isArray(deptsRes) ? deptsRes : []);
                setRecentLogs(Array.isArray(logsRes) ? logsRes.slice(0, 5) : []);

                // Load evidence for top cases
                const evPromises = casesList.slice(0, 8).map(c =>
                    getEvidence(c.public_id).then(items => Array.isArray(items) ? items : []).catch(() => [])
                );
                const evResults = await Promise.all(evPromises);
                setEvidence(evResults.flat());
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadOverviewData();
    }, []);

    const openCases = cases.filter(c => c.status?.toUpperCase() === 'OPEN' || !c.status);
    const inProgressCases = cases.filter(c => c.status?.toUpperCase() === 'IN_PROGRESS');

    return (
        <AppLayout activePage="overview">
            <div className="animate-slide">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <div className="page-title">Admin Command Center</div>
                        <div className="page-sub">Operational metrics, forensic cases & integrity status</div>
                    </div>
                </div>

                {/* Primary Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
                    <StatCard value={cases.length} label="Total Cases" />
                    <StatCard value={openCases.length} label="Open Cases" />
                    <StatCard value={inProgressCases.length} label="In Progress" />
                    <StatCard value={evidence.length} label="Evidence Tracked" />
                    <StatCard value={users.length} label="Active Members" />
                    <StatCard value={departments.length} label="Departments" />
                </div>

                {/* Split Overview Panels */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    {/* Active Cases */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <SectionTitle style={{ margin: 0, border: 'none', padding: 0 }}>Recent Cases</SectionTitle>
                            <button className="btn" onClick={() => navigate('/admin/cases')} style={{ fontSize: 9, padding: '2px 8px' }}>
                                View All Cases →
                            </button>
                        </div>
                        {cases.length === 0 ? (
                            <Empty>No cases registered yet</Empty>
                        ) : (
                            cases.slice(0, 6).map(c => (
                                <Row key={c.public_id} onClick={() => navigate(`/admin/cases/${c.public_id}`)}>
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', flexShrink: 0, width: 80 }}>
                                        {c.public_id?.slice(0, 8)}...
                                    </span>
                                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {c.title}
                                    </span>
                                    <Badge status={c.status} />
                                    <span style={{ color: 'var(--ink3)', fontSize: 12, marginLeft: 4 }}>▸</span>
                                </Row>
                            ))
                        )}
                    </div>

                    {/* Recent Evidence Items */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <SectionTitle style={{ margin: 0, border: 'none', padding: 0 }}>Recent Evidence</SectionTitle>
                            <button className="btn" onClick={() => navigate('/admin/evidence')} style={{ fontSize: 9, padding: '2px 8px' }}>
                                Open Vault →
                            </button>
                        </div>
                        {evidence.length === 0 ? (
                            <Empty>No evidence uploaded yet</Empty>
                        ) : (
                            evidence.slice(0, 6).map((e, i) => (
                                <Row key={e.public_id || i} onClick={() => navigate('/admin/evidence')}>
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', flexShrink: 0, width: 60 }}>
                                        {e.type || 'FILE'}
                                    </span>
                                    <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {e.file_name || e.name}
                                    </span>
                                    <Badge status={e.integrityStatus || 'VALID'} />
                                    <span style={{ color: 'var(--ink3)', fontSize: 12, marginLeft: 4 }}>▸</span>
                                </Row>
                            ))
                        )}
                    </div>
                </div>

                {/* Audit & Quick Actions Bar */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <SectionTitle style={{ margin: 0, border: 'none', padding: 0 }}>Latest Security Audits</SectionTitle>
                            <button className="btn" onClick={() => navigate('/admin/audit')} style={{ fontSize: 9, padding: '2px 8px' }}>
                                Full Audit Trail →
                            </button>
                        </div>
                        {recentLogs.length === 0 ? (
                            <Empty>No security logs recorded yet</Empty>
                        ) : (
                            recentLogs.map((log, idx) => (
                                <Row key={log.public_id || idx} onClick={() => navigate(`/admin/audit/${log.public_id}`)}>
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', width: 80, flexShrink: 0 }}>
                                        {new Date(log.timestamp || log.created_at || Date.now()).toLocaleTimeString('en-IN')}
                                    </span>
                                    <span style={{ flex: 1, fontSize: 11, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {log.action || log.event}
                                    </span>
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>
                                        {log.actor_id ? log.actor_id.slice(0, 6) : 'System'}
                                    </span>
                                </Row>
                            ))
                        )}
                    </div>

                    <div className="card">
                        <SectionTitle>Fast Navigation</SectionTitle>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <button className="btn" onClick={() => navigate('/admin/cases')} style={{ padding: '12px', justifyContent: 'flex-start' }}>
                                📁 Manage Cases
                            </button>
                            <button className="btn" onClick={() => navigate('/admin/evidence')} style={{ padding: '12px', justifyContent: 'flex-start' }}>
                                🛡️ Evidence Vault
                            </button>
                            <button className="btn" onClick={() => navigate('/admin/custody')} style={{ padding: '12px', justifyContent: 'flex-start' }}>
                                🔗 Chain of Custody
                            </button>
                            <button className="btn" onClick={() => navigate('/admin/members')} style={{ padding: '12px', justifyContent: 'flex-start' }}>
                                👥 Member Directory
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
