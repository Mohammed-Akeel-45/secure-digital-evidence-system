import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { UserDashboard } from './pages/UserDashboard';

export default function App() {
  const { isAuthenticated, isAdmin } = useAuth();

  if (!isAuthenticated) return <LoginPage />;
  if (isAdmin) return <AdminDashboard />;
  return <UserDashboard />;
}
