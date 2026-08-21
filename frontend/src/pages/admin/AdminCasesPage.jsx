import React, { useState, useEffect } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { getCases } from '../../api/auth';
import { Cases } from '../../components/admin/Cases';

export function AdminCasesPage() {
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);

    const refreshCases = async () => {
        setLoading(true);
        try {
            const list = await getCases();
            setCases(Array.isArray(list) ? list : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshCases();
    }, []);

    return (
        <AppLayout activePage="cases">
            <Cases cases={cases} onRefresh={refreshCases} />
        </AppLayout>
    );
}
