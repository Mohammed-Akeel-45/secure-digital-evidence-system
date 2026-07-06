import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createMember, getOrgUsers, getOrgRoles, getOrgDepartments } from '../../api/auth';
import { Row, Empty, SectionTitle } from './AdminCommon';
import { Field, ErrorBanner, SuccessBanner } from '../auth/FormParts';

export function Members({ onRefresh }) {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        orgRole: '',
        departmentId: '',
        departmentRole: ''
    });

    const [errors, setErrors] = useState({});
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const [members, setMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(true);

    const [allRoles, setAllRoles] = useState([]);
    const [departments, setDepartments] = useState([]);

    useEffect(() => {
        loadMembers();
        loadRolesAndDepartments();
    }, []);

    const loadMembers = async () => {
        try {
            setMembersLoading(true);
            const users = await getOrgUsers();
            setMembers(users || []);
        } catch (err) {
            console.error(err);
            setError('FAILED TO LOAD ORGANIZATION USERS');
        } finally {
            setMembersLoading(false);
        }
    };

    const loadRolesAndDepartments = async () => {
        try {
            const [rolesList, deptsList] = await Promise.all([
                getOrgRoles(),
                getOrgDepartments()
            ]);
            setAllRoles(rolesList || []);
            setDepartments(deptsList || []);
        } catch (err) {
            console.error("Failed to load roles/departments", err);
        }
    };

    const set = (k) => (e) => {
        setForm(f => ({
            ...f,
            [k]: e.target.value
        }));

        setErrors(er => ({
            ...er,
            [k]: ''
        }));
    };

    const handleDepartmentChange = (e) => {
        const deptId = e.target.value;
        const deptRoles = allRoles.filter(r => r.scope_type === 'DEPARTMENT' && r.scope_id === deptId);
        setForm(f => ({
            ...f,
            departmentId: deptId,
            departmentRole: deptRoles.length > 0 ? deptRoles[0].name : ''
        }));
    };

    const validate = () => {
        const errs = {};

        if (!form.name.trim()) {
            errs.name = 'Required';
        }

        if (!form.email.includes('@')) {
            errs.email = 'Valid email required';
        }

        if (form.password.length < 6) {
            errs.password = 'Min 6 characters';
        }

        if (!form.orgRole || form.orgRole === "INVALID_ROLE") {
            errs.orgRole = 'Required';
        }

        return errs;
    };

    const submit = async (e) => {
        e.preventDefault();

        const errs = validate();

        if (Object.keys(errs).length) {
            setErrors(errs);
            return;
        }

        setError('');
        setSuccess('');
        setLoading(true);

        try {
            await createMember({
                name: form.name,
                email: form.email,
                password: form.password,
                org_role: form.orgRole,
                department_id: form.departmentId || null,
                department_role: form.departmentId ? form.departmentRole : null
            });

            setSuccess(`MEMBER "${form.name.toUpperCase()}" CREATED`);

            const orgRoles = allRoles.filter(r => r.scope_type === 'ORG');
            setForm({
                name: '',
                email: '',
                password: '',
                orgRole: orgRoles.length > 0 ? orgRoles[0].name : '',
                departmentId: '',
                departmentRole: ''
            });

            await loadMembers();
            onRefresh();
        } catch (err) {
            setError(
                err?.message?.toUpperCase() ||
                'FAILED TO CREATE MEMBER'
            );
        } finally {
            setLoading(false);
        }
    };

    const departmentRoles = allRoles.filter(r => r.scope_type === 'DEPARTMENT' && r.scope_id === form.departmentId);

    return (
        <div className="animate-slide">
            <div className="page-title">Members</div>

            <div className="page-sub">
                Admin creates and manages all user credentials
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 320px',
                    gap: 16
                }}
            >
                <div className="card">
                    <SectionTitle>
                        Organization Members ({members.length})
                    </SectionTitle>

                    {membersLoading ? (
                        <Empty>Loading members...</Empty>
                    ) : members.length === 0 ? (
                        <Empty>No organization members found.</Empty>
                    ) : (
                        members.map((m) => (
                            <Row key={m.public_id} onClick={() => navigate(`/admin/user/${m.public_id}`)}>
                                <div
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        background: 'var(--rule)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontFamily: 'var(--mono)',
                                        fontSize: 11,
                                        color: 'var(--ink2)',
                                        flexShrink: 0
                                    }}
                                >
                                    {m.name
                                        .split(' ')
                                        .map(n => n[0])
                                        .join('')
                                        .slice(0, 2)
                                        .toUpperCase()}
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            flexWrap: 'wrap'
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 500
                                            }}
                                        >
                                            {m.name}
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            fontFamily: 'var(--mono)',
                                            fontSize: 9,
                                            color: 'var(--ink3)',
                                            marginTop: 2
                                        }}
                                    >
                                        {m.email}
                                    </div>

                                    {m.roles?.length > 0 && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: 6,
                                                flexWrap: 'wrap',
                                                marginTop: 8
                                            }}
                                        >
                                            {m.roles.map((role) => (
                                                <span
                                                    key={role}
                                                    style={{
                                                        fontSize: 10,
                                                        padding: '3px 8px',
                                                        borderRadius: 999,
                                                        background: 'var(--rule)',
                                                        color: 'var(--ink2)',
                                                        fontWeight: 500,
                                                        textTransform: 'capitalize'
                                                    }}
                                                >
                                                    {role}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Row>
                        ))
                    )}
                </div>

                <div
                    className="card"
                    style={{ alignSelf: 'start' }}
                >
                    <SectionTitle>Add Member</SectionTitle>

                    <div
                        style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 9,
                            color: 'var(--ink3)',
                            marginBottom: 14,
                            lineHeight: 1.7
                        }}
                    >
                        Set the credentials for the new employee.
                    </div>

                    <ErrorBanner message={error} />
                    <SuccessBanner message={success} />

                    <form onSubmit={submit}>
                        <Field
                            label="Full Name"
                            error={errors.name}
                        >
                            <input
                                className="input"
                                value={form.name}
                                onChange={set('name')}
                                placeholder="Full name"
                            />
                        </Field>

                        <Field
                            label="Email"
                            error={errors.email}
                        >
                            <input
                                className="input"
                                type="email"
                                value={form.email}
                                onChange={set('email')}
                                placeholder="employee@dept.gov"
                            />
                        </Field>

                        <Field
                            label="Password"
                            error={errors.password}
                        >
                            <input
                                className="input"
                                type="password"
                                value={form.password}
                                onChange={set('password')}
                                placeholder="Set their password"
                            />
                        </Field>

                        <Field label="Organization Role" error={errors.orgRole}>
                            <select
                                className="select"
                                value={form.orgRole}
                                onChange={set('orgRole')}
                            >
                                <option key="INVALID_ROLE" value="INVALID_ROLE">Select Role</option>
                                {Array.from(new Set(allRoles.filter(r => r.scope_type === 'ORG' && r.name !== "ORG_ADMIN").map(r => r.name))).map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </Field>

                        <Field label="Department (Optional)">
                            <select
                                className="select"
                                value={form.departmentId}
                                onChange={handleDepartmentChange}
                            >
                                <option value="">No Department</option>
                                {departments.map(d => (
                                    <option key={d.public_id} value={d.public_id}>{d.name}</option>
                                ))}
                            </select>
                        </Field>

                        {form.departmentId && (
                            <Field label="Department Role">
                                <select
                                    className="select"
                                    value={form.departmentRole}
                                    onChange={set('departmentRole')}
                                    disabled={departmentRoles.length === 0}
                                >
                                    {departmentRoles.length === 0 ? (
                                        <option value="">No roles defined for this department</option>
                                    ) : (
                                        Array.from(new Set(departmentRoles.map(r => r.name))).map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))
                                    )}
                                </select>
                            </Field>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: 12 }}
                            disabled={loading}
                        >
                            {loading
                                ? 'Creating...'
                                : 'Create Member'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
