import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createDepartment, deleteDepartment, getOrgDepartments } from '../../api/auth';
import { Row, Empty, SectionTitle } from './AdminCommon';
import { Field, ErrorBanner, SuccessBanner } from '../auth/FormParts';
import { confirmAction } from './ConfirmDialog';

export function Departments() {
    const navigate = useNavigate();
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [creating, setCreating] = useState(false);

    const loadDepartments = async () => {
        setLoading(true);
        try {
            const list = await getOrgDepartments();
            setDepartments(list || []);
        } catch (err) {
            setError('FAILED TO LOAD DEPARTMENTS');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDepartments();
    }, []);

    const handleCreateDept = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { setError('NAME IS REQUIRED'); return; }
        setError(''); setSuccess(''); setCreating(true);
        try {
            await createDepartment({ name: form.name });
            setSuccess(`DEPARTMENT "${form.name.toUpperCase()}" CREATED`);
            setForm({ name: '' });
            await loadDepartments();
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteDept = async (deptId, deptName) => {
        const confirmed = await confirmAction({
            title: 'Delete Department',
            message: `CRITICAL: You are about to permanently delete department "${deptName}" and all cases associated with it. This action cannot be undone.`,
            expectedName: deptName,
            confirmText: 'Delete',
            isDelete: true
        });

        if (!confirmed) return;

        try {
            await deleteDepartment(deptId);
            await loadDepartments();
        } catch (err) {
            console.log(err);
            setError("FAILED TO DELETE DEPARTMENT");
        }
    };

    return (
        <div className="animate-slide">
            <div className="page-title">Departments</div>
            <div className="page-sub">Manage organization departments and their cases</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="card">
                        <SectionTitle>All Departments ({departments.length})</SectionTitle>
                        {loading ? (
                            <Empty>Loading departments...</Empty>
                        ) : departments.length === 0 ? (
                            <Empty>No departments found. Create your first department →</Empty>
                        ) : (
                            departments.map(d => (
                                <div key={d.public_id} style={{ borderBottom: '1px solid var(--rule2)', paddingBottom: 8, marginBottom: 8 }}>
                                    <Row onClick={() => navigate(`/admin/department/${d.public_id}`)}>
                                        <div style={{ flex: 1, fontWeight: 500, fontSize: 13 }}>{d.name}</div>
                                        <button
                                            className="btn"
                                            style={{ fontSize: 9, padding: '3px 8px', marginRight: 8, background: 'rgba(255, 68, 68, 0.1)', color: '#ff4444' }}
                                            onClick={(e) => { e.stopPropagation(); handleDeleteDept(d.public_id, d.name); }}
                                        >
                                            Delete
                                        </button>
                                        <span style={{ color: 'var(--ink3)', fontSize: 12 }}>▸</span>
                                    </Row>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <div className="card" style={{ alignSelf: 'start' }}>
                    <SectionTitle>New Department</SectionTitle>
                    <ErrorBanner message={error} />
                    <SuccessBanner message={success} />
                    <form onSubmit={handleCreateDept}>
                        <Field label="Department Name">
                            <input className="input" value={form.name} onChange={e => { setForm({ name: e.target.value }); setError(''); }} placeholder="e.g. Homicide, Cybercrime" />
                        </Field>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={creating}>
                            {creating ? 'Creating...' : 'Create Department'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
