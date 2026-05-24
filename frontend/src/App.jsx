import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { UserDashboard } from './pages/UserDashboard';

function ProtectedAdmin({ children }) {
    const { isAuthenticated, isAdmin } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (!isAdmin) return <Navigate to="/dashboard" replace />;
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
        <BrowserRouter>
            <Routes>
                <Route
                    path="/login"
                    element={
                        isAuthenticated
                            ? <Navigate to={isAdmin ? '/admin/overview' : '/dashboard/cases'} replace />
                            : <LoginPage />
                    }
                />

                {/* Admin routes */}
                <Route path="/admin/:page" element={
                    <ProtectedAdmin><AdminDashboard /></ProtectedAdmin>
                } />
                <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />

                {/* User routes */}
                <Route path="/dashboard/:page" element={
                    <ProtectedUser><UserDashboard /></ProtectedUser>
                } />
                <Route path="/dashboard" element={<Navigate to="/dashboard/cases" replace />} />

                {/* Root redirect */}
                <Route
                    path="/"
                    element={
                        <Navigate to={
                            !isAuthenticated ? '/login' :
                                isAdmin ? '/admin/overview' : '/dashboard/cases'
                        } replace />
                    }
                />

                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

