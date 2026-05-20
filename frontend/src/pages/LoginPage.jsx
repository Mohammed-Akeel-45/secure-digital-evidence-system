import { useState } from 'react';
import { AuthShell, Logo } from '../components/auth/AuthShell';
import { RoleSelector } from '../components/auth/RoleSelector';
import { UserLoginForm } from '../components/auth/UserLoginForm';
import { AdminAuthForm } from '../components/auth/AdminAuthForm';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const [role, setRole] = useState('user');

  return (
    <AuthShell>
      <Logo />

      <div className={styles.card}>
        <RoleSelector value={role} onChange={setRole} />

        <div className="animate-fade" key={role}>
          {role === 'user' ? <UserLoginForm /> : <AdminAuthForm />}
        </div>
      </div>

      <div className={styles.footer}>
        All access is logged and monitored. Unauthorized access is a criminal offence.
      </div>
    </AuthShell>
  );
}

