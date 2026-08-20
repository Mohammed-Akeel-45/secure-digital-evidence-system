import React from 'react';
import { AppLayout } from '../../components/AppLayout';
import { DepartmentDetails } from '../../components/admin/DepartmentDetails';

export function AdminDepartmentDetailPage() {
    return (
        <AppLayout activePage="departments">
            <DepartmentDetails />
        </AppLayout>
    );
}
