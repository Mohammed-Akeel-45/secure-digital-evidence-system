import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { loginUser } from '../../api/auth';
import { Field, ErrorBanner } from './FormParts';
import '../../auth.css';

export function UserLoginForm() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('EMAIL AND PASSWORD ARE REQUIRED'); return; }
    setError('');
    setLoading(true);
    try {
      const data = await loginUser(form);
      login({ id: data.user_id, name: data.user_name, role: 'user' }, data.access_token);
    } catch (err) {
      setError(err.message.toUpperCase());
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <ErrorBanner message={error} />

      <Field label="Email">
        <input className="auth-input" type="email" placeholder="officer@department.gov"
          value={form.email} onChange={set('email')} autoComplete="email" />
      </Field>

      <Field label="Password">
        <input className="auth-input" type="password" placeholder="Password"
          value={form.password} onChange={set('password')} autoComplete="current-password" />
      </Field>

      <button type="submit" className="auth-btn" disabled={loading}>
        {loading ? 'Authenticating...' : 'Login'}
      </button>

      <div className="auth-note">
        Credentials are issued by your administrator.
      </div>
    </form>
  );
}

