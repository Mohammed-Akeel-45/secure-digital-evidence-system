import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    getUserDetails,
    deleteUser,
    getUserRoles,
    getOrgDepartments,
    getCases,
    getOrgRoles,
    updateUserDepartment,
    assignUserRoles,
    revokeUserRoles,
    assignUserToCase,
    removeUserFromCase
} from '../../api/auth';
import { Row, Badge, Empty, SectionTitle } from './AdminCommon';
import { Field, ErrorBanner, SuccessBanner } from '../auth/FormParts';
import { confirmAction } from './ConfirmDialog';
import { useAuth } from '../../context/AuthContext';

export function UserDetails({ onRefresh }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [userRoles, setUserRoles] = useState([]);
    const [userCases, setUserCases] = useState([]);

    const [departments, setDepartments] = useState([]);
    const [allCases, setAllCases] = useState([]);
    const [allRoles, setAllRoles] = useState([]);

    // Form/action states
    const [selectedDeptId, setSelectedDeptId] = useState('');
    const [updatingDept, setUpdatingDept] = useState(false);

    const [selectedCaseId, setSelectedCaseId] = useState('');
    const [assigningCase, setAssigningCase] = useState(false);

    const [roleScopeType, setRoleScopeType] = useState('ORG');
    const [roleScopeId, setRoleScopeId] = useState('');
    const [roleName, setRoleName] = useState('');
    const [assigningRole, setAssigningRole] = useState(false);

    const isSelf = currentUser && user && currentUser.email === user.email;

    // Filter available roles by scope type selected
    const scopeFilteredRoles = allRoles.filter(r => {
        if (r.scope_type !== roleScopeType) return false;
        if (roleScopeType === 'DEPARTMENT') {
            return r.scope_id === (user ? user.department_id : '');
        }
        return true;
    });

    // Filters unassigned cases for case assignment dropdown
    const unassignedCases = allCases.filter(c => !userCases.some(uc => uc.public_id === c.public_id));

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [uDetails, uRoles, uCases, depts, rolesList] = await Promise.all([
                getUserDetails(id),
                getUserRoles(id),
                getCases(null, id),
                getOrgDepartments(),
                getOrgRoles()
            ]);

            const casesList = uDetails.department_id ? await getCases(uDetails.department_id) : [];

            setUser(uDetails);
            setUserRoles(uRoles || []);
            setUserCases(uCases || []);
            setDepartments(depts || []);
            setAllCases(casesList || []);
            setAllRoles(rolesList || []);

            // Set default selections
            setSelectedDeptId(uDetails.department_id || '');
            if (depts && depts.length > 0) {
                // If the user doesn't have a department, select the first one as default option
                if (!uDetails.department_id) setSelectedDeptId(depts[0].public_id);
            }

            // Filter cases user is not already assigned to
            const unassignedCases = (casesList || []).filter(c => !(uCases || []).some(uc => uc.public_id === c.public_id));
            if (unassignedCases.length > 0) {
                setSelectedCaseId(unassignedCases[0].public_id);
            } else {
                setSelectedCaseId('');
            }

            if (roleScopeType === 'DEPARTMENT') {
                setRoleScopeId(uDetails.department_id || '');
            } else if (roleScopeType === 'CASE' && (uCases || []).length > 0) {
                setRoleScopeId(uCases[0].public_id);
            } else {
                setRoleScopeId('');
            }

            if (rolesList && rolesList.length > 0) {
                setRoleName(rolesList[0].name);
            }
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            loadAllData();
        }
    }, [id]);

    useEffect(() => {
        if (scopeFilteredRoles.length > 0) {
            const exists = scopeFilteredRoles.some(r => r.name === roleName);
            if (!exists) {
                setRoleName(scopeFilteredRoles[0].name);
            }
        } else {
            setRoleName('');
        }
    }, [roleScopeType, scopeFilteredRoles.length, roleName]);

    const handleUpdateDepartment = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setUpdatingDept(true);
        try {
            await updateUserDepartment({ userId: id, departmentId: selectedDeptId });
            setSuccess('DEPARTMENT UPDATED SUCCESSFULLY');
            await loadAllData();
            if (onRefresh) onRefresh();
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally {
            setUpdatingDept(false);
        }
    };

    const handleAssignCase = async (e) => {
        e.preventDefault();
        if (!selectedCaseId) return;
        setError('');
        setSuccess('');
        setAssigningCase(true);
        try {
            await assignUserToCase({ caseId: selectedCaseId, userId: id });
            setSuccess('USER ASSIGNED TO CASE SUCCESSFULLY');
            await loadAllData();
            if (onRefresh) onRefresh();
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally {
            setAssigningCase(false);
        }
    };

    const handleRemoveFromCase = async (casePublicId) => {
        const confirmed = await confirmAction({
            title: 'Remove User from Case',
            message: 'Are you sure you want to remove the user from this case? They will lose access to all case evidence.',
            confirmText: 'Remove',
            isDelete: true
        });
        if (!confirmed) return;

        setError('');
        setSuccess('');
        try {
            await removeUserFromCase({ caseId: casePublicId, userId: id });
            setSuccess('USER REMOVED FROM CASE SUCCESSFULLY');
            await loadAllData();
            if (onRefresh) onRefresh();
        } catch (err) {
            setError(err.message.toUpperCase());
        }
    };

    const handleAssignRole = async (e) => {
        e.preventDefault();
        if (!roleName) return;

        setError('');
        setSuccess('');
        setAssigningRole(true);
        try {
            let finalScopeId = roleScopeId;
            if (roleScopeType === 'ORG') {
                finalScopeId = user.org_id;
            } else if (roleScopeType === 'DEPARTMENT') {
                finalScopeId = user.department_id;
            }

            await assignUserRoles({
                userId: id,
                roleNames: [roleName],
                scopeType: roleScopeType,
                scopeId: finalScopeId
            });

            setSuccess(`ROLE ${roleName} ASSIGNED SUCCESSFULLY`);
            await loadAllData();
        } catch (err) {
            setError(err.message.toUpperCase());
        } finally {
            setAssigningRole(false);
        }
    };

    const handleRevokeRole = async (role) => {
        const confirmed = await confirmAction({
            title: 'Revoke Role',
            message: `Are you sure you want to revoke the role "${role.name}" from this user?`,
            confirmText: 'Revoke',
            isDelete: true
        });
        if (!confirmed) return;

        setError('');
        setSuccess('');
        try {
            await revokeUserRoles({
                userId: id,
                roleNames: [role.name],
                scopeType: role.scope_type,
                scopeId: role.scope_id
            });

            setSuccess(`ROLE ${role.name} REVOKED SUCCESSFULLY`);
            await loadAllData();
        } catch (err) {
            setError(err.message.toUpperCase());
        }
    };

    const handleDeleteUser = async () => {
        const confirmed = await confirmAction({
            title: 'Delete User Account',
            message: `CRITICAL: You are about to permanently delete user account "${user.name}" from the organization. This will immediately revoke all user roles, access rights, and sessions. This action cannot be undone.`,
            expectedName: user.name,
            confirmText: 'Delete User',
            isDelete: true
        });
        if (!confirmed) return;

        setError('');
        setSuccess('');
        try {
            await deleteUser(id);
            alert('USER DELETED SUCCESSFULLY');
            if (onRefresh) onRefresh();
            navigate('/admin/members');
        } catch (err) {
            setError(err.message.toUpperCase());
        }
    };

    if (loading) {
        return (
            <div className="animate-slide">
                <div className="page-title">User Details</div>
                <Empty>Loading user details...</Empty>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="animate-slide">
                <div className="page-title">User Details</div>
                <ErrorBanner message={error || 'User not found'} />
                <button className="btn" onClick={() => navigate('/admin/members')} style={{ marginTop: 12 }}>
                    ← Back to Members
                </button>
            </div>
        );
    }

    return (
        <div className="animate-slide">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <button className="btn" onClick={() => navigate('/admin/members')} style={{ padding: '6px 12px', fontSize: 11 }}>
                    ← Back
                </button>
                <div className="page-title" style={{ margin: 0 }}>{user.name}</div>
            </div>

            <div className="page-sub" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span>{user.email}</span>
                <span>•</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>ID: {user.public_id}</span>
                {user.is_org_admin && (
                    <>
                        <span>•</span>
                        <span style={{ color: 'var(--blue)', fontSize: 11, fontWeight: 'bold' }}>ORGANIZATION ADMIN</span>
                    </>
                )}
            </div>

            <ErrorBanner message={error} />
            <SuccessBanner message={success} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginTop: 16 }}>

                {/* Left Column: Department & Case Management */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* General & Department Info */}
                    <div className="card">
                        <SectionTitle>Department Configuration</SectionTitle>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--rule2)' }}>
                                <span style={{ color: 'var(--ink3)', fontSize: 12 }}>Current Department:</span>
                                {user.department_id ? (
                                    <span
                                        onClick={() => navigate(`/admin/department/${user.department_id}`)}
                                        style={{ color: 'var(--blue)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}
                                    >
                                        {user.department_name}
                                    </span>
                                ) : (
                                    <span style={{ color: 'var(--ink3)', fontSize: 13, fontStyle: 'italic' }}>None Assigned</span>
                                )}
                            </div>
                        </div>

                        <form onSubmit={handleUpdateDepartment} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <Field label="Update User Department">
                                    <select
                                        className="select"
                                        value={selectedDeptId}
                                        onChange={e => setSelectedDeptId(e.target.value)}
                                    >
                                        <option value="">No Department</option>
                                        {departments.map(d => (
                                            <option key={d.public_id} value={d.public_id}>{d.name}</option>
                                        ))}
                                    </select>
                                </Field>
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ height: 38 }} disabled={updatingDept}>
                                {updatingDept ? 'Saving...' : 'Update'}
                            </button>
                        </form>

                        {!isSelf && (
                            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed var(--rule2)' }}>
                                <span style={{ color: 'var(--ink3)', fontSize: 11, display: 'block', marginBottom: 8 }}>DANGER ZONE</span>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={handleDeleteUser}
                                    style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                                >
                                    Remove User from Organization
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Case Assignments */}
                    <div className="card">
                        <SectionTitle>Assigned Cases ({userCases.length})</SectionTitle>

                        {userCases.length === 0 ? (
                            <Empty>Not assigned to any cases.</Empty>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                                {userCases.map(c => (
                                    <div
                                        key={c.public_id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '8px 10px',
                                            background: 'var(--bg-active)',
                                            borderRadius: 4,
                                            border: '1px solid var(--rule2)'
                                        }}
                                    >
                                        <div
                                            onClick={() => navigate(`/admin/case/${c.public_id}`)}
                                            style={{ cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}
                                        >
                                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink3)' }}>
                                                {c.public_id.slice(0, 8)}...
                                            </span>
                                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                                                {c.title}
                                            </span>
                                            <Badge status={c.status} />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFromCase(c.public_id)}
                                            className="btn"
                                            style={{
                                                padding: '2px 6px',
                                                fontSize: 10,
                                                color: 'var(--red)',
                                                border: '1px solid var(--red)',
                                                background: 'transparent'
                                            }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <form onSubmit={handleAssignCase} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 16 }}>
                            <div style={{ flex: 1 }}>
                                <Field label="Assign User to Case">
                                    <select
                                        className="select"
                                        value={selectedCaseId}
                                        onChange={e => setSelectedCaseId(e.target.value)}
                                        disabled={unassignedCases.length === 0}
                                    >
                                        {unassignedCases.length === 0 ? (
                                            <option>No available cases</option>
                                        ) : (
                                            unassignedCases.map(c => (
                                                <option key={c.public_id} value={c.public_id}>{c.title}</option>
                                            ))
                                        )}
                                    </select>
                                </Field>
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{ height: 38 }}
                                disabled={assigningCase || unassignedCases.length === 0}
                            >
                                {assigningCase ? 'Assigning...' : 'Assign'}
                            </button>
                        </form>
                    </div>

                </div>

                {/* Right Column: Roles Management */}
                <div className="card" style={{ alignSelf: 'start' }}>
                    <SectionTitle>User Roles ({userRoles.length})</SectionTitle>

                    {userRoles.length === 0 ? (
                        <Empty>No explicit roles assigned.</Empty>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                            {userRoles.map((r, index) => (
                                <div
                                    key={index}
                                    style={{
                                        padding: 10,
                                        background: 'var(--bg-active)',
                                        borderRadius: 4,
                                        border: '1px solid var(--rule2)'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{r.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRevokeRole(r)}
                                            className="btn"
                                            style={{
                                                padding: '2px 6px',
                                                fontSize: 10,
                                                color: 'var(--red)',
                                                border: '1px solid var(--red)',
                                                background: 'transparent'
                                            }}
                                        >
                                            Revoke
                                        </button>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 4 }}>
                                        {r.description}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, fontSize: 10, flexWrap: 'wrap' }}>
                                        <span style={{ background: 'var(--rule)', padding: '2px 6px', borderRadius: 2 }}>
                                            SCOPE: {r.scope_type}
                                        </span>
                                        {r.scope_type !== 'ORG' && r.scope_name && (
                                            <span
                                                onClick={() => {
                                                    if (r.scope_type === 'DEPARTMENT') navigate(`/admin/department/${r.scope_id}`);
                                                    if (r.scope_type === 'CASE') navigate(`/admin/case/${r.scope_id}`);
                                                }}
                                                style={{
                                                    background: 'var(--rule)',
                                                    padding: '2px 6px',
                                                    borderRadius: 2,
                                                    color: 'var(--blue)',
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline'
                                                }}
                                            >
                                                ENTITY: {r.scope_name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!user.is_org_admin && (
                        <>
                            <SectionTitle style={{ marginTop: 24 }}>Assign New Role</SectionTitle>
                            <form onSubmit={handleAssignRole}>
                                <Field label="Scope Type">
                                    <select
                                        className="select"
                                        value={roleScopeType}
                                        onChange={e => {
                                            const nextScope = e.target.value;
                                            setRoleScopeType(nextScope);
                                            if (nextScope === 'DEPARTMENT') {
                                                setRoleScopeId(user.department_id || '');
                                            } else if (nextScope === 'CASE' && userCases.length > 0) {
                                                setRoleScopeId(userCases[0].public_id);
                                            } else {
                                                setRoleScopeId('');
                                            }
                                        }}
                                    >
                                        <option value="ORG">Organization (ORG)</option>
                                        <option value="DEPARTMENT" disabled={!user.department_id}>
                                            Department (DEPARTMENT) {!user.department_id && '(Assign department first)'}
                                        </option>
                                        <option value="CASE" disabled={userCases.length === 0}>
                                            Case (CASE) {userCases.length === 0 && '(Assign to case first)'}
                                        </option>
                                    </select>
                                </Field>

                                {roleScopeType === 'CASE' && (
                                    <Field label="Target Case">
                                        <select
                                            className="select"
                                            value={roleScopeId}
                                            onChange={e => setRoleScopeId(e.target.value)}
                                        >
                                            {userCases.map(c => (
                                                <option key={c.public_id} value={c.public_id}>{c.title}</option>
                                            ))}
                                        </select>
                                    </Field>
                                )}

                                <Field label="Role Selection">
                                    <select
                                        className="select"
                                        value={roleName}
                                        onChange={e => setRoleName(e.target.value)}
                                        disabled={scopeFilteredRoles.length === 0}
                                    >
                                        {scopeFilteredRoles.length === 0 ? (
                                            <option>No roles defined for this scope</option>
                                        ) : (
                                            // Remove duplicates to simplify selection UI
                                            Array.from(new Set(scopeFilteredRoles.map(r => r.name))).map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))
                                        )}
                                    </select>
                                </Field>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ width: '100%', marginTop: 12 }}
                                    disabled={assigningRole || scopeFilteredRoles.length === 0}
                                >
                                    {assigningRole ? 'Assigning...' : 'Assign Role'}
                                </button>
                            </form>
                        </>
                    )}
                </div>

            </div>
        </div>
    );
}
