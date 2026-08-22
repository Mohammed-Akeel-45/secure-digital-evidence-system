import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { getCases } from '../../api/auth';
import { Badge, Empty, SectionTitle, Row, StatCard } from '../../components/admin/AdminCommon';

export function UserCasesPage() {
    const navigate = useNavigate();
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const loadMyCases = async () => {
        setLoading(true);
        try {
            const list = await getCases();
            setCases(Array.isArray(list) ? list : []);
        } catch (err) {
            console.error(err);
            setCases([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMyCases();
    }, []);

    const filteredCases = cases.filter(c => {
        if (statusFilter !== 'ALL' && c.status?.toUpperCase() !== statusFilter) return false;
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            const titleMatch = c.title?.toLowerCase().includes(term);
            const idMatch = c.public_id?.toLowerCase().includes(term);
            const descMatch = c.description?.toLowerCase().includes(term);
            if (!titleMatch && !idMatch && !descMatch) return false;
        }
        return true;
    });

    const openCount = cases.filter(c => c.status?.toUpperCase() === 'OPEN' || !c.status).length;
    const inProgressCount = cases.filter(c => c.status?.toUpperCase() === 'IN_PROGRESS').length;

    return (
        <AppLayout activePage="cases">
            <div className="animate-slide">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <div className="page-title">My Assigned Cases</div>
                        <div className="page-sub">Forensic investigations assigned to your unit by administration</div>
                    </div>
                    <button className="btn" onClick={loadMyCases} disabled={loading} style={{ fontSize: 10, padding: '6px 14px' }}>
                        {loading ? 'Refreshing...' : 'Refresh Cases'}
                    </button>
                </div>

                {/* Quick Case Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                    <StatCard value={cases.length} label="Total Assigned Cases" />
                    <StatCard value={openCount} label="Open Cases" />
                    <StatCard value={inProgressCount} label="In Progress" />
                </div>

                {/* Filter and Search Bar */}
                <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 220 }}>
                            <input
                                type="text"
                                placeholder="Search cases by title, reference ID or scope..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="input"
                                style={{ height: 32, fontSize: 11, fontFamily: 'var(--mono)' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {['ALL', 'OPEN', 'IN_PROGRESS', 'CLOSED', 'ARCHIVED'].map(st => (
                                <button
                                    key={st}
                                    onClick={() => setStatusFilter(st)}
                                    className="btn"
                                    style={{
                                        fontSize: 9,
                                        padding: '4px 8px',
                                        background: statusFilter === st ? 'rgba(255,255,255,0.12)' : 'transparent',
                                        border: `1px solid ${statusFilter === st ? 'var(--ink)' : 'var(--rule2)'}`
                                    }}
                                >
                                    {st}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Cases Table */}
                <div className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--rule2)' }}>
                        <SectionTitle style={{ margin: 0, border: 'none', padding: 0 }}>
                            Investigation Cases ({filteredCases.length})
                        </SectionTitle>
                    </div>

                    {loading ? (
                        <Empty>Loading your assigned case files...</Empty>
                    ) : filteredCases.length === 0 ? (
                        <Empty>No cases assigned to your account.</Empty>
                    ) : (
                        filteredCases.map(c => (
                            <div key={c.public_id} style={{ borderBottom: '1px solid var(--rule2)', padding: '14px 20px' }}>
                                <Row onClick={() => navigate(`/dashboard/cases/${c.public_id}`)}>
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', width: 90, flexShrink: 0 }}>
                                        {c.public_id?.slice(0, 8)}...
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {c.title}
                                        </div>
                                        {c.description && (
                                            <div style={{ fontSize: 11, color: 'var(--ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                                                {c.description}
                                            </div>
                                        )}
                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginTop: 4 }}>
                                            Opened: {new Date(c.created_at || Date.now()).toLocaleDateString('en-IN')}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                        {c.priority && (
                                            <span style={{
                                                fontFamily: 'var(--mono)',
                                                fontSize: 8,
                                                padding: '1px 6px',
                                                background: c.priority === 'high' ? 'rgba(255,60,60,0.1)' : 'rgba(255,255,255,0.05)',
                                                color: c.priority === 'high' ? '#ff4444' : '#aaa',
                                                textTransform: 'uppercase'
                                            }}>
                                                {c.priority}
                                            </span>
                                        )}
                                        <Badge status={c.status} />
                                        <span style={{ color: 'var(--ink3)', fontSize: 12, marginLeft: 4 }}>▸</span>
                                    </div>
                                </Row>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
