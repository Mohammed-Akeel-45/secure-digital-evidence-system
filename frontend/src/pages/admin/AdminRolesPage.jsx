import React, { useState, useEffect } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { Roles } from '../../components/admin/Roles';
import { getCases } from '../../api/auth';

export function AdminRolesPage() {
    const [cases, setCases] = useState([]);

    useEffect(() => {
        getCases().then(data => setCases(Array.isArray(data) ? data : (data?.cases || []))).catch(() => setCases([]));
    }, []);

    return (
        <AppLayout activePage="roles">
            <Roles cases={cases} />
        </AppLayout>
    );
}
