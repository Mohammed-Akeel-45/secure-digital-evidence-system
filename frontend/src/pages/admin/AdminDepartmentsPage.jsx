import React from 'react';
import { AppLayout } from '../../components/AppLayout';
import { Departments } from '../../components/admin/Departments';

export function AdminDepartmentsPage() {
    return (
        <AppLayout activePage="departments">
            <Departments />
        </AppLayout>
    );
}
