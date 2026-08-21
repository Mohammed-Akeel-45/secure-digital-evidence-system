import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRolePermissions, getAllPermissions, attachPermissionsToRole, detachPermissionsFromRole } from '../../api/auth';
import { SectionTitle, Empty } from './AdminCommon';
import { ErrorBanner, SuccessBanner } from '../auth/FormParts';

export function RoleDetails() {
    const params = useParams();
    const roleName = params.roleName || params.param1 || params.id || '';
    const scopeType = (params.scopeType || params.param2 || 'ORG').toUpperCase();
    const scopeId = params.scopeId || params.param3 || (scopeType === 'ORG' ? 'org' : '');
    const navigate = useNavigate();

    const [allPermissions, setAllPermissions] = useState([]);
    const [assignedPermissions, setAssignedPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const loadPermissionsData = async () => {
        setLoading(true);
        setError('');
        try {
            const allPerms = await getAllPermissions();
            setAllPermissions(allPerms || []);

            if (roleName) {
                const assignedPerms = await getRolePermissions(roleName, scopeType, scopeId);
                setAssignedPermissions((assignedPerms || []).map(p => p.name));
            }
        } catch (err) {
            setError(err.message?.toUpperCase() || 'FAILED TO LOAD ROLE PERMISSIONS');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPermissionsData();
    }, [roleName, scopeType, scopeId]);

    const handleTogglePermission = async (permissionName, isAssigned) => {
        setError('');
        setSuccess('');
        setActionLoading(true);
        try {
            if (isAssigned) {
                // Detach
                await detachPermissionsFromRole({
                    roleName,
                    scopeType,
                    scopeId,
                    permissions: [permissionName]
                });
                setAssignedPermissions(prev => prev.filter(p => p !== permissionName));
                setSuccess(`DETACHED PERMISSION: ${permissionName}`);
            } else {
                // Attach
                await attachPermissionsToRole({
                    roleName,
                    scopeType,
                    scopeId,
                    permissions: [permissionName]
                });
                setAssignedPermissions(prev => [...prev, permissionName]);
                setSuccess(`ATTACHED PERMISSION: ${permissionName}`);
            }
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="animate-slide">
                <div className="page-title">Role Details</div>
                <Empty>Loading role permissions...</Empty>
            </div>
        );
    }

    return (
        <div className="animate-slide">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <button className="btn" onClick={() => navigate('/admin/roles')} style={{ padding: '6px 12px', fontSize: 11 }}>
                    ← Back
                </button>
                <div className="page-title" style={{ margin: 0 }}>Role: {roleName}</div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>SCOPE:</span>
                    <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        fontFamily: 'var(--mono)',
                        fontSize: 9,
                        background: 'rgba(255,255,255,0.06)',
                        color: '#ccc',
                        textTransform: 'uppercase'
                    }}>{scopeType}</span>
                </div>
            </div>
            <div className="page-sub">Configure and map permissions for this role context • Scope ID: {scopeId}</div>

            <ErrorBanner message={error} />
            <SuccessBanner message={success} />

            <div className="card">
                <SectionTitle>Manage Permissions</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {allPermissions.length === 0 ? (
                        <Empty>No permissions found in SDES system.</Empty>
                    ) : (
                        allPermissions.map(p => {
                            const isAssigned = assignedPermissions.includes(p.name);
                            return (
                                <div
                                    key={p.name}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '10px 14px',
                                        borderBottom: '1px solid var(--rule2)',
                                        background: isAssigned ? 'rgba(0, 200, 120, 0.03)' : 'transparent',
                                        borderRadius: 4
                                    }}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--mono)', color: isAssigned ? '#00c878' : 'var(--ink)' }}>
                                            {p.name}
                                        </span>
                                        {p.description && (
                                            <span style={{ fontSize: 10, color: 'var(--ink3)' }}>
                                                {p.description}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        className={`btn ${isAssigned ? 'btn-primary' : ''}`}
                                        style={{
                                            fontSize: 9,
                                            padding: '4px 12px',
                                            borderColor: isAssigned ? '#00c878' : 'var(--rule)',
                                            color: isAssigned ? '#fff' : 'var(--ink2)',
                                            background: isAssigned ? '#00c878' : 'transparent',
                                            width: 80
                                        }}
                                        disabled={actionLoading || roleName === "ORG_ADMIN"}
                                        onClick={() => handleTogglePermission(p.name, isAssigned)}
                                    >
                                        {isAssigned ? 'Attached' : 'Attach'}
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
