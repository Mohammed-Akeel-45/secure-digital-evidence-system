import React from 'react';
import { Empty } from './AdminCommon';

export function Audit() {
    return (
        <div className="animate-slide">
            <div className="page-title">Audit Log</div>
            <div className="page-sub">Immutable access and action log</div>
            <div className="card">
                <Empty>Audit log endpoint not yet exposed via HTTP.</Empty>
            </div>
        </div>
    );
}
