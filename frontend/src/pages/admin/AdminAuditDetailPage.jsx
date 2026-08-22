import React from 'react';
import { AppLayout } from '../../components/AppLayout';
import { AuditLogDetails } from '../../components/admin/AuditLogDetails';

export function AdminAuditDetailPage() {
    return (
        <AppLayout activePage="audit">
            <AuditLogDetails />
        </AppLayout>
    );
}
