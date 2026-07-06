import React from 'react';
import { StatCard, SectionTitle, Empty, Row, Badge } from './AdminCommon';

export function Overview({ cases, evidence }) {
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
