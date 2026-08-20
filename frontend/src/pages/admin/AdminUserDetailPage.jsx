import React from 'react';
import { AppLayout } from '../../components/AppLayout';
import { UserDetails } from '../../components/admin/UserDetails';

export function AdminUserDetailPage() {
    return (
        <AppLayout activePage="members">
            <UserDetails />
        </AppLayout>
    );
}
