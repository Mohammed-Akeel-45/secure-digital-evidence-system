import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustodyLogs } from '../../api/auth';
import { Row, Badge, Empty, SectionTitle, StatCard, formatFileSize } from './AdminCommon';

export function CustodyLogs() {
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchEvidence, setSearchEvidence] = useState('');
    const [filterAction, setFilterAction] = useState('ALL');
    const [expandedLog, setExpandedLog] = useState(null);

    const fetchLogs = async () => {
        setLoading(true);
        setError('');
        try {
            const params = {};
            if (searchEvidence.trim()) {
                params.evidence_id = searchEvidence.trim();
            }
            const data = await getCustodyLogs(params);
            setLogs(data || []);
        } catch (err) {
            setError(err.message || 'Failed to load custody logs');
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log => {
        if (filterAction !== 'ALL' && log.action !== filterAction) return false;
        return true;
    });

    const uniqueEvidences = new Set(logs.map(l => l.evidence_name || l.evidence_public_id || l.public_id)).size;
    const uploadCount = logs.filter(l => l.action === 'UPLOAD').length;

    return (
        <div className="animate-slide">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                    <div className="page-title">Chain of Custody</div>
                    <div className="page-sub">Tamper-evident custody tracking & historical transfer ledger</div>
                </div>
                <button className="btn" onClick={fetchLogs} disabled={loading} style={{ fontSize: 10, padding: '6px 14px' }}>
                    {loading ? 'Refreshing...' : 'Refresh Logs'}
                </button>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                <StatCard value={logs.length} label="Total Custody Events" />
                <StatCard value={uniqueEvidences} label="Evidences Tracked" />
                <StatCard value={uploadCount} label="Initial Ingestions" />
            </div>

            {/* Filter Bar */}
            <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <input
                            type="text"
                            placeholder="Filter by Evidence Name / UUID..."
                            value={searchEvidence}
                            onChange={(e) => setSearchEvidence(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') fetchLogs(); }}
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                background: 'var(--card)',
                                border: '1px solid var(--rule2)',
                                color: 'var(--ink)',
                                fontFamily: 'var(--mono)',
                                fontSize: 11
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {['ALL', 'UPLOAD', 'VIEW', 'VERIFY', 'DOWNLOAD'].map(act => (
                            <button
                                key={act}
                                onClick={() => setFilterAction(act)}
                                className="btn"
                                style={{
                                    fontSize: 9,
                                    padding: '4px 8px',
                                    background: filterAction === act ? 'rgba(255,255,255,0.12)' : 'transparent',
                                    border: `1px solid ${filterAction === act ? 'var(--ink)' : 'var(--rule2)'}`
                                }}
                            >
                                {act}
                            </button>
                        ))}
                    </div>
                    <button className="btn" onClick={fetchLogs} style={{ fontSize: 10, padding: '6px 12px' }}>
                        Search
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ padding: '10px 14px', background: 'rgba(255,60,60,0.1)', border: '1px solid #ff4444', color: '#ff6666', fontFamily: 'var(--mono)', fontSize: 10, marginBottom: 16 }}>
                    {error.toUpperCase()}
                </div>
            )}

            {/* Custody Log Timeline / Table */}
            <div className="card">
                <SectionTitle>Custody Ledger ({filteredLogs.length} Records)</SectionTitle>

                {loading && <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)', padding: 24, textAlign: 'center' }}>LOADING CUSTODY RECORDS...</div>}

                {!loading && filteredLogs.length === 0 && (
                    <Empty>No chain of custody logs found.</Empty>
                )}

                {!loading && filteredLogs.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '150px 100px 1fr 140px 120px', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--rule2)', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase' }}>
                            <div>Timestamp</div>
                            <div>Action</div>
                            <div>Evidence & Case</div>
                            <div>Actor & ID</div>
                            <div style={{ textAlign: 'right' }}>Actions</div>
                        </div>

                        {filteredLogs.map(log => {
                            const isExpanded = expandedLog === log.public_id;
                            const evDisplayName = log.evidence_name || (log.action_metadata?.file_name) || (log.evidence_public_id ? `EVID: ${log.evidence_public_id.slice(0, 8)}...` : 'Evidence Item');
                            const caseDisplayName = log.case_title || (log.action_metadata?.case_title) || (log.case_public_id ? `Case: ${log.case_public_id.slice(0, 8)}...` : '');
                            const actorName = log.user_name || (log.action_metadata?.user_name) || 'User';

                            return (
                                <div key={log.public_id || log.timestamp} style={{ borderBottom: '1px solid var(--rule2)', padding: '10px 0' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '150px 100px 1fr 140px 120px', gap: 12, alignItems: 'center' }}>
                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>
                                            {new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}
                                        </div>
                                        <div>
                                            <Badge status={log.action} />
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                                                    {evDisplayName}
                                                </span>
                                                {caseDisplayName && (
                                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 2 }}>
                                                        {caseDisplayName}
                                                    </span>
                                                )}
                                                {log.action_metadata?.file_size && (
                                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: '#888' }}>
                                                        ({formatFileSize(log.action_metadata.file_size)})
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 2 }}>
                                                {log.remarks || 'No remarks recorded'}
                                            </div>
                                        </div>
                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>
                                            <div style={{ color: 'var(--ink)', fontWeight: 500 }}>{actorName}</div>
                                            <div style={{ fontSize: 8, color: '#777' }} title={log.public_id}>
                                                {log.public_id ? log.public_id.slice(0, 10) + '...' : '-'}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                            <button
                                                className="btn"
                                                onClick={() => navigate(`/admin/custody-log/${log.public_id}`)}
                                                style={{ fontSize: 8, padding: '2px 8px', color: 'var(--accent)' }}
                                            >
                                                Details &rarr;
                                            </button>
                                            {log.action_metadata && Object.keys(log.action_metadata).length > 0 && (
                                                <button
                                                    className="btn"
                                                    onClick={() => setExpandedLog(isExpanded ? null : log.public_id)}
                                                    style={{ fontSize: 8, padding: '2px 6px' }}
                                                >
                                                    {isExpanded ? 'Hide' : 'Quick'}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {isExpanded && log.action_metadata && (
                                        <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--rule2)', borderRadius: 2 }}>
                                            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginBottom: 4, textTransform: 'uppercase' }}>Action Metadata</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontFamily: 'var(--mono)', fontSize: 10 }}>
                                                {log.action_metadata.file_name && (
                                                    <div><span style={{ color: 'var(--ink3)' }}>FILE: </span>{log.action_metadata.file_name}</div>
                                                )}
                                                {log.action_metadata.file_size && (
                                                    <div><span style={{ color: 'var(--ink3)' }}>SIZE: </span>{formatFileSize(log.action_metadata.file_size)}</div>
                                                )}
                                                {log.action_metadata.case_title && (
                                                    <div><span style={{ color: 'var(--ink3)' }}>CASE: </span>{log.action_metadata.case_title}</div>
                                                )}
                                                {log.action_metadata.user_name && (
                                                    <div><span style={{ color: 'var(--ink3)' }}>USER: </span>{log.action_metadata.user_name}</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
