import React from 'react';
import { AppLayout } from '../../components/AppLayout';
import { CustodyLogs } from '../../components/admin/CustodyLogs';

export function UserCustodyPage() {
    return (
        <AppLayout activePage="custody">
            <CustodyLogs />
        </AppLayout>
    );
}
