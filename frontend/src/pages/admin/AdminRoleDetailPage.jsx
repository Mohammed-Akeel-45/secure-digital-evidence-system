import React from 'react';
import { AppLayout } from '../../components/AppLayout';
import { RoleDetails } from '../../components/admin/RoleDetails';

export function AdminRoleDetailPage() {
    return (
        <AppLayout activePage="roles">
            <RoleDetails />
        </AppLayout>
    );
}
