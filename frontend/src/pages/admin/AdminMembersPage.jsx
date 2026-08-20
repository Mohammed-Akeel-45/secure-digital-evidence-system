import React from 'react';
import { AppLayout } from '../../components/AppLayout';
import { Members } from '../../components/admin/Members';

export function AdminMembersPage() {
    return (
        <AppLayout activePage="members">
            <Members />
        </AppLayout>
    );
}
