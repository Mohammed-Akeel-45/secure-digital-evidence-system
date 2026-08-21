import React from 'react';
import { AppLayout } from '../../components/AppLayout';
import { CaseDetails } from '../../components/admin/CaseDetails';

export function AdminCaseDetailPage() {
    return (
        <AppLayout activePage="cases">
            <CaseDetails isUserView={false} />
        </AppLayout>
    );
}
