import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrgDepartments, getCases, createCase } from '../../api/auth';
import { Row, Badge, Empty, SectionTitle } from './AdminCommon';
import { Field, ErrorBanner, SuccessBanner } from '../auth/FormParts';

export function DepartmentDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const [department, setDepartment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cases, setCases] = useState([]);
    const [casesLoading, setCasesLoading] = useState(false);

    // Case creation form state
    const [caseForm, setCaseForm] = useState({ title: '', description: '', priority: 'low' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [creating, setCreating] = useState(false);

    const loadDepartmentData = async () => {
        setLoading(true);
        try {
            const depts = await getOrgDepartments();
            const dept = depts.find(d => d.public_id === id);
            if (!dept) {
                setError('DEPARTMENT NOT FOUND');
                setLoading(false);
                return;
            }
            setDepartment(dept);
            
            // Load cases for this department
            setCasesLoading(true);
            const list = await getCases(dept.public_id);
            setCases(list || []);
            setCasesLoading(false);
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            loadDepartmentData();
        }
    }, [id]);

    const handleCreateCase = async (e) => {
        e.preventDefault();
        if (!caseForm.title.trim()) { setError('TITLE IS REQUIRED'); return; }
        setError(''); setSuccess(''); setCreating(true);
        try {
            await createCase({
                title: caseForm.title,
                description: caseForm.description,
                priority: caseForm.priority,
                dept_id: department.public_id
            });
            setSuccess('CASE CREATED SUCCESSFULLY');
            setCaseForm({ title: '', description: '', priority: 'low' });
            
            // Reload cases
            const list = await getCases(department.public_id);
            setCases(list || []);
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally {
            setCreating(false);
        }
    };

    if (loading) {
        return (
            <div className="animate-slide">
                <div className="page-title">Department Details</div>
                <Empty>Loading department details...</Empty>
            </div>
        );
    }

    if (!department) {
        return (
            <div className="animate-slide">
                <div className="page-title">Department Details</div>
                <ErrorBanner message={error || 'Department not found'} />
                <button className="btn" onClick={() => navigate('/admin/departments')} style={{ marginTop: 12 }}>
                    ← Back to Departments
                </button>
            </div>
        );
    }

    return (
        <div className="animate-slide">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <button className="btn" onClick={() => navigate('/admin/departments')} style={{ padding: '6px 12px', fontSize: 11 }}>
                    ← Back
                </button>
                <div className="page-title" style={{ margin: 0 }}>{department.name}</div>
            </div>
            <div className="page-sub">Department Command Centre • {department.public_id}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
                <div className="card">
                    <SectionTitle>Department Cases ({cases.length})</SectionTitle>
                    {casesLoading ? (
                        <Empty>Loading cases...</Empty>
                    ) : cases.length === 0 ? (
                        <Empty>No cases created for this department yet.</Empty>
                    ) : (
                        cases.map(c => (
                            <div key={c.public_id} style={{ padding: '12px 0', borderBottom: '1px solid var(--rule2)' }}>
                                <Row onClick={() => navigate(`/admin/case/${c.public_id}`)}>
                                    <span style={{ fontSize: 10, color: 'var(--ink3)', fontFamily: 'var(--mono)', width: 80 }}>
                                        {c.public_id.slice(0, 8)}...
                                    </span>
                                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                                        {c.title}
                                    </span>
                                    <Badge status={c.status} />
                                    <span style={{ color: 'var(--ink3)', fontSize: 12, marginLeft: 4 }}>▸</span>
                                </Row>
                            </div>
                        ))
                    )}
                </div>

                <div className="card" style={{ alignSelf: 'start' }}>
                    <SectionTitle>Create Case</SectionTitle>
                    <ErrorBanner message={error} />
                    <SuccessBanner message={success} />
                    <form onSubmit={handleCreateCase}>
                        <Field label="Title">
                            <input className="input" value={caseForm.title} onChange={e => setCaseForm(cf => ({ ...cf, title: e.target.value }))} placeholder="Case title" />
                        </Field>
                        <Field label="Description">
                            <textarea className="input" style={{ height: 64, resize: 'none' }} value={caseForm.description} onChange={e => setCaseForm(cf => ({ ...cf, description: e.target.value }))} placeholder="Optional details..." />
                        </Field>
                        <Field label="Priority">
                            <select className="select" value={caseForm.priority} onChange={e => setCaseForm(cf => ({ ...cf, priority: e.target.value }))}>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </Field>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={creating}>
                            {creating ? 'Creating...' : 'Create Case'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
