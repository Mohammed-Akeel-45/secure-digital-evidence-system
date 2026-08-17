import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { getCases, getEvidence } from '../api/auth';
import { Overview } from '../components/admin/Overview';
import { Cases } from '../components/admin/Cases';
import { Departments } from '../components/admin/Departments';
import { Roles } from '../components/admin/Roles';
import { Members } from '../components/admin/Members';
import { Audit } from '../components/admin/Audit';
import { CustodyLogs } from '../components/admin/CustodyLogs';
import { AuditLogDetails } from '../components/admin/AuditLogDetails';
import { CustodyLogDetails } from '../components/admin/CustodyLogDetails';
import { DepartmentDetails } from '../components/admin/DepartmentDetails';
import { CaseDetails } from '../components/admin/CaseDetails';
import { RoleDetails } from '../components/admin/RoleDetails';
import { UserDetails } from '../components/admin/UserDetails';

const NAV = [
    { type: 'section', label: 'Operations' },
    { id: 'overview', label: 'Overview' },
    { id: 'cases', label: 'Case Management' },
    { type: 'section', label: 'Organization' },
    { id: 'members', label: 'Members' },
    { id: 'departments', label: 'Departments' },
    { type: 'section', label: 'Security & Audit' },
    { id: 'roles', label: 'Roles' },
    { id: 'custody', label: 'Chain of Custody' },
    { id: 'audit', label: 'Audit Logs' },
];

export function AdminDashboard() {
    const { page } = useParams();
    const navigate = useNavigate();
    const [cases, setCases] = useState([]);
    const [evidence, setEvidence] = useState([]);

    const currentPage = page || 'overview';

    let activeNav = currentPage;
    if (currentPage === 'department') activeNav = 'departments';
    if (currentPage === 'case') activeNav = 'cases';
    if (currentPage === 'role') activeNav = 'roles';
    if (currentPage === 'user') activeNav = 'members';
    if (currentPage === 'audit-log') activeNav = 'audit';
    if (currentPage === 'custody-log') activeNav = 'custody';

    const refresh = async () => {
        try {
            const list = await getCases();
            setCases(list || []);

            // Fetch evidence for each case in parallel to sum up
            const evPromises = (list || []).map(c => getEvidence(c.public_id).catch(() => []));
            const evResults = await Promise.all(evPromises);
            const allEv = evResults.flat();
            setEvidence(allEv);
        } catch { }
    };

    useEffect(() => { refresh(); }, []);

    const pages = {
        overview: <Overview cases={cases} evidence={evidence} />,
        cases: <Cases cases={cases} onRefresh={refresh} />,
        departments: <Departments />,
        roles: <Roles cases={cases} />,
        members: <Members onRefresh={refresh} />,
        custody: <CustodyLogs />,
        audit: <Audit />,
        department: <DepartmentDetails />,
        case: <CaseDetails />,
        role: <RoleDetails />,
        user: <UserDetails onRefresh={refresh} />,
        'audit-log': <AuditLogDetails />,
        'custody-log': <CustodyLogDetails />
    };

    return (
        <AppLayout navItems={NAV} activePage={activeNav} onNavigate={(id) => navigate(`/admin/${id}`)}>
            {pages[currentPage] || pages.overview}
        </AppLayout>
    );
}
