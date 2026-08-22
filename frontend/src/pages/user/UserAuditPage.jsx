import React from 'react';
import { AppLayout } from '../../components/AppLayout';
import { Audit } from '../../components/admin/Audit';

export function UserAuditPage() {
    return (
        <AppLayout activePage="audit">
            <Audit />
        </AppLayout>
    );
}
