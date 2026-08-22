import React from 'react';
import { AppLayout } from '../../components/AppLayout';
import { CustodyLogs } from '../../components/admin/CustodyLogs';

export function AdminCustodyPage() {
    return (
        <AppLayout activePage="custody">
            <CustodyLogs />
        </AppLayout>
    );
}
