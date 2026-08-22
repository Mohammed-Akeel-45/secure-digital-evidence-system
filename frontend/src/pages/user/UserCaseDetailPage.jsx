import React from 'react';
import { AppLayout } from '../../components/AppLayout';
import { CaseDetails } from '../../components/admin/CaseDetails';

export function UserCaseDetailPage() {
    return (
        <AppLayout activePage="cases">
            <CaseDetails isUserView={true} />
        </AppLayout>
    );
}
