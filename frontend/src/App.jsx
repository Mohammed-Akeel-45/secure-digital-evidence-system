import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { ErrorBoundary } from './components/ErrorBoundary';

// Admin Pages
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminCasesPage } from './pages/admin/AdminCasesPage';
import { AdminCaseDetailPage } from './pages/admin/AdminCaseDetailPage';
import { AdminEvidencePage } from './pages/admin/AdminEvidencePage';
import { AdminMembersPage } from './pages/admin/AdminMembersPage';
import { AdminUserDetailPage } from './pages/admin/AdminUserDetailPage';
import { AdminDepartmentsPage } from './pages/admin/AdminDepartmentsPage';
import { AdminDepartmentDetailPage } from './pages/admin/AdminDepartmentDetailPage';
import { AdminRolesPage } from './pages/admin/AdminRolesPage';
import { AdminRoleDetailPage } from './pages/admin/AdminRoleDetailPage';
import { AdminCustodyPage } from './pages/admin/AdminCustodyPage';
import { AdminCustodyDetailPage } from './pages/admin/AdminCustodyDetailPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { AdminAuditDetailPage } from './pages/admin/AdminAuditDetailPage';

// User / Officer Pages
import { UserCasesPage } from './pages/user/UserCasesPage';
import { UserCaseDetailPage } from './pages/user/UserCaseDetailPage';
import { UserEvidencePage } from './pages/user/UserEvidencePage';
import { UserCustodyPage } from './pages/user/UserCustodyPage';
import { UserAuditPage } from './pages/user/UserAuditPage';

function ProtectedAdmin({ children }) {
    const { isAuthenticated, isAdmin } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (!isAdmin) return <Navigate to="/dashboard/cases" replace />;
    return children;
}

function ProtectedUser({ children }) {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return children;
}

export default function App() {
    const { isAuthenticated, isAdmin } = useAuth();

    return (
        <ErrorBoundary>
        <BrowserRouter>
            <Routes>
                {/* Authentication */}
                <Route
                    path="/login"
                    element={
                        isAuthenticated
                            ? <Navigate to={isAdmin ? '/admin/overview' : '/dashboard/cases'} replace />
                            : <LoginPage />
                    }
                />

                {/* ── Admin Multi-Page Routes ── */}
                <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
                
                <Route path="/admin/overview" element={
                    <ProtectedAdmin><AdminOverviewPage /></ProtectedAdmin>
                } />
                
                <Route path="/admin/cases" element={
                    <ProtectedAdmin><AdminCasesPage /></ProtectedAdmin>
                } />
                <Route path="/admin/cases/:id" element={
                    <ProtectedAdmin><AdminCaseDetailPage /></ProtectedAdmin>
                } />
                <Route path="/admin/case/:id" element={
                    <ProtectedAdmin><AdminCaseDetailPage /></ProtectedAdmin>
                } />

                <Route path="/admin/evidence" element={
                    <ProtectedAdmin><AdminEvidencePage /></ProtectedAdmin>
                } />

                <Route path="/admin/members" element={
                    <ProtectedAdmin><AdminMembersPage /></ProtectedAdmin>
                } />
                <Route path="/admin/members/:id" element={
                    <ProtectedAdmin><AdminUserDetailPage /></ProtectedAdmin>
                } />
                <Route path="/admin/user/:id" element={
                    <ProtectedAdmin><AdminUserDetailPage /></ProtectedAdmin>
                } />

                <Route path="/admin/departments" element={
                    <ProtectedAdmin><AdminDepartmentsPage /></ProtectedAdmin>
                } />
                <Route path="/admin/departments/:id" element={
                    <ProtectedAdmin><AdminDepartmentDetailPage /></ProtectedAdmin>
                } />
                <Route path="/admin/department/:id" element={
                    <ProtectedAdmin><AdminDepartmentDetailPage /></ProtectedAdmin>
                } />

                <Route path="/admin/roles" element={
                    <ProtectedAdmin><AdminRolesPage /></ProtectedAdmin>
                } />
                <Route path="/admin/roles/:roleName" element={
                    <ProtectedAdmin><AdminRoleDetailPage /></ProtectedAdmin>
                } />
                <Route path="/admin/role/:roleName" element={
                    <ProtectedAdmin><AdminRoleDetailPage /></ProtectedAdmin>
                } />
                <Route path="/admin/role/:roleName/:scopeType/:scopeId" element={
                    <ProtectedAdmin><AdminRoleDetailPage /></ProtectedAdmin>
                } />

                <Route path="/admin/custody" element={
                    <ProtectedAdmin><AdminCustodyPage /></ProtectedAdmin>
                } />
                <Route path="/admin/custody/:id" element={
                    <ProtectedAdmin><AdminCustodyDetailPage /></ProtectedAdmin>
                } />
                <Route path="/admin/custody-log/:id" element={
                    <ProtectedAdmin><AdminCustodyDetailPage /></ProtectedAdmin>
                } />

                <Route path="/admin/audit" element={
                    <ProtectedAdmin><AdminAuditPage /></ProtectedAdmin>
                } />
                <Route path="/admin/audit/:id" element={
                    <ProtectedAdmin><AdminAuditDetailPage /></ProtectedAdmin>
                } />
                <Route path="/admin/audit-log/:id" element={
                    <ProtectedAdmin><AdminAuditDetailPage /></ProtectedAdmin>
                } />

                {/* ── User Multi-Page Routes ── */}
                <Route path="/dashboard" element={<Navigate to="/dashboard/cases" replace />} />
                
                <Route path="/dashboard/cases" element={
                    <ProtectedUser><UserCasesPage /></ProtectedUser>
                } />
                <Route path="/dashboard/cases/:id" element={
                    <ProtectedUser><UserCaseDetailPage /></ProtectedUser>
                } />
                <Route path="/dashboard/case/:id" element={
                    <ProtectedUser><UserCaseDetailPage /></ProtectedUser>
                } />

                <Route path="/dashboard/evidence" element={
                    <ProtectedUser><UserEvidencePage /></ProtectedUser>
                } />

                <Route path="/dashboard/custody" element={
                    <ProtectedUser><UserCustodyPage /></ProtectedUser>
                } />
                <Route path="/dashboard/custody/:id" element={
                    <ProtectedUser><AdminCustodyDetailPage /></ProtectedUser>
                } />
                <Route path="/dashboard/custody-log/:id" element={
                    <ProtectedUser><AdminCustodyDetailPage /></ProtectedUser>
                } />

                <Route path="/dashboard/audit" element={
                    <ProtectedUser><UserAuditPage /></ProtectedUser>
                } />
                <Route path="/dashboard/audit/:id" element={
                    <ProtectedUser><AdminAuditDetailPage /></ProtectedUser>
                } />
                <Route path="/dashboard/audit-log/:id" element={
                    <ProtectedUser><AdminAuditDetailPage /></ProtectedUser>
                } />

                {/* Root Redirect */}
                <Route
                    path="/"
                    element={
                        <Navigate to={
                            !isAuthenticated ? '/login' :
                                isAdmin ? '/admin/overview' : '/dashboard/cases'
                        } replace />
                    }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
        </ErrorBoundary>
    );
}
