import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRole, deleteRole, getOrgRoles, getAllPermissions, getOrgDepartments } from '../../api/auth';
import { SectionTitle, Empty, Row } from './AdminCommon';
import { Field, ErrorBanner, SuccessBanner } from '../auth/FormParts';
import { confirmAction } from './ConfirmDialog';

export function Roles({ cases }) {
    const navigate = useNavigate();
    const [roles, setRoles] = useState([]);
    const [rolesLoading, setRolesLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ORG'); // ORG, DEPARTMENT, CASE
    const [allPermissions, setAllPermissions] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedScopeEntity, setSelectedScopeEntity] = useState('');

    // Creation Form State
    const [form, setForm] = useState({ name: '', description: '' });
    const [selectedPermissions, setSelectedPermissions] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [creating, setCreating] = useState(false);

    const loadRoles = async () => {
        setRolesLoading(true);
        try {
            const list = await getOrgRoles(activeTab);
            setRoles(list || []);
        } catch (err) {
            console.error(err);
        } finally {
            setRolesLoading(false);
        }
    };

    const loadPermissions = async () => {
        try {
            const list = await getAllPermissions();
            setAllPermissions(list || []);
        } catch (err) {
            console.error(err);
        }
    };

    const loadDepartments = async () => {
        try {
            const list = await getOrgDepartments();
            setDepartments(list || []);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        loadRoles();
        setSelectedScopeEntity('');
    }, [activeTab]);

    useEffect(() => {
        loadPermissions();
        loadDepartments();
    }, []);

    const togglePermission = (name) => {
        setSelectedPermissions(prev =>
            prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
        );
    };

    const handleCreateRole = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { setError('ROLE NAME IS REQUIRED'); return; }
        if (selectedPermissions.length === 0) { setError('SELECT AT LEAST ONE PERMISSION'); return; }
        if (activeTab !== 'ORG' && !selectedScopeEntity) {
            setError(`PLEASE SELECT A TARGET ${activeTab} CONTEXT`);
            return;
        }

        setError(''); setSuccess(''); setCreating(true);
        try {
            await createRole({
                name: form.name,
                description: form.description,
                permissions: selectedPermissions,
                scopeType: activeTab,
                scopeId: selectedScopeEntity
            });
            setSuccess(`ROLE "${form.name.toUpperCase()}" CREATED`);
            setForm({ name: '', description: '' });
            setSelectedPermissions([]);
            setSelectedScopeEntity('');
            await loadRoles();
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteRole = async (name, scopeType, scopeId) => {
        const confirmed = await confirmAction({
            title: 'Delete Role',
            message: `CRITICAL: You are about to permanently delete role "${name}" for scope ${scopeType}. This will revoke this role from all assigned users. This action cannot be undone.`,
            expectedName: name,
            confirmText: 'Delete',
            isDelete: true
        });

        if (!confirmed) return;

        try {
            await deleteRole(name, scopeType, scopeId);
            await loadRoles();
        } catch (err) {
            console.error(err);
            setError('FAILED TO DELETE ROLE');
        }
    };

    return (
        <div className="animate-slide">
            <div className="page-title">Role Management</div>
            <div className="page-sub">Configure organization, department and case scopes roles and attach permissions</div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--rule2)', paddingBottom: 8 }}>
                {['ORG', 'DEPARTMENT', 'CASE'].map(tab => (
                    <button
                        key={tab}
                        className={`btn ${activeTab === tab ? 'btn-primary' : ''}`}
                        style={{ fontSize: 10, padding: '6px 16px', textTransform: 'uppercase' }}
                        onClick={() => { setActiveTab(tab); setError(''); setSuccess(''); }}
                    >
                        {tab} Roles
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
                <div className="card">
                    <SectionTitle>{activeTab} Roles List ({roles.length})</SectionTitle>
                    {rolesLoading ? (
                        <Empty>Loading roles...</Empty>
                    ) : roles.length === 0 ? (
                        <Empty>No {activeTab.toLowerCase()} roles found. Create one →</Empty>
                    ) : (
                        roles.map(r => (
                            <div key={r.public_id} style={{ borderBottom: '1px solid var(--rule2)', paddingBottom: 8, marginBottom: 8 }}>
                                <Row onClick={() => navigate(`/admin/role/${r.name}/${r.scope_type}/${r.scope_id || 'org'}`)}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {r.name}
                                            <span style={{ fontSize: 9, background: 'var(--rule2)', padding: '2px 6px', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>{r.scope_name || ""}</span>
                                        </div>
                                        {r.description && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>{r.description}</div>}
                                    </div>
                                    {r.name !== "ORG_ADMIN" && <button
                                        className="btn"
                                        style={{ fontSize: 9, padding: '3px 8px', marginRight: 8, background: 'rgba(255, 68, 68, 0.1)', color: '#ff4444' }}
                                        onClick={(e) => { e.stopPropagation(); handleDeleteRole(r.name, r.scope_type, r.scope_id); }}
                                    >
                                        Delete
                                    </button>
                                    }
                                    <span style={{ color: 'var(--ink3)', fontSize: 12 }}>▸</span>
                                </Row>
                            </div>
                        ))
                    )}
                </div>

                <div className="card">
                    <SectionTitle>New {activeTab} Role</SectionTitle>
                    <ErrorBanner message={error} />
                    <SuccessBanner message={success} />
                    <form onSubmit={handleCreateRole}>
                        <Field label="Role Name">
                            <input className="input" value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError(''); }} placeholder="e.g. DEPT_HEAD, INVESTIGATOR" />
                        </Field>
                        <Field label="Description">
                            <textarea className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Explain role responsibilities..." style={{ height: 60, resize: 'none' }} />
                        </Field>
                        {activeTab === 'DEPARTMENT' && (
                            <Field label="Select Department">
                                <select className="select" value={selectedScopeEntity} onChange={e => { setSelectedScopeEntity(e.target.value); setError(''); }}>
                                    <option value="">Choose department...</option>
                                    {departments.map(d => <option key={d.public_id} value={d.public_id}>{d.name}</option>)}
                                </select>
                            </Field>
                        )}
                        {activeTab === 'CASE' && (
                            <Field label="Select Case">
                                <select className="select" value={selectedScopeEntity} onChange={e => { setSelectedScopeEntity(e.target.value); setError(''); }}>
                                    <option value="">Choose case...</option>
                                    {cases.map(c => <option key={c.public_id} value={c.public_id}>{c.title}</option>)}
                                </select>
                            </Field>
                        )}
                        <Field label="Select Permissions">
                            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--rule)', padding: 8, background: 'rgba(0,0,0,0.1)' }}>
                                {allPermissions.length === 0 ? (
                                    <div style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'center' }}>No permissions loaded</div>
                                ) : (
                                    allPermissions.map(p => (
                                        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }} onClick={() => togglePermission(p.name)}>
                                            <input type="checkbox" checked={selectedPermissions.includes(p.name)} onChange={() => { }} />
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: 11, fontWeight: 500, fontFamily: 'var(--mono)' }}>{p.name}</span>
                                                {p.description && <span style={{ fontSize: 9, color: 'var(--ink3)' }}>{p.description}</span>}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Field>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} disabled={creating}>
                            {creating ? 'Creating...' : 'Create Role'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
