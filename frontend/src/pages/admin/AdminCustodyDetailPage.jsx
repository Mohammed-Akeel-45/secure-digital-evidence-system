import React from 'react';
import { AppLayout } from '../../components/AppLayout';
import { CustodyLogDetails } from '../../components/admin/CustodyLogDetails';

export function AdminCustodyDetailPage() {
    return (
        <AppLayout activePage="custody">
            <CustodyLogDetails />
        </AppLayout>
    );
}
