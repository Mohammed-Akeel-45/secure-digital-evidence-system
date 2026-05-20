import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { loginAdmin, registerAdmin } from '../../api/auth';
import { Field, ErrorBanner, SuccessBanner } from './FormParts';
import styles from './AdminAuthForm.module.css';
import '../../auth.css';

function AdminLoginForm() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('EMAIL AND PASSWORD ARE REQUIRED'); return; }
    setError(''); setLoading(true);
    try {
      const data = await loginAdmin(form);
      login({ id: data.user_id, name: data.user_name, role: 'admin' }, data.access_token);
    } catch (err) {
      setError(err.message.toUpperCase());
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} noValidate>
      <ErrorBanner message={error} />
      <Field label="Admin Email">
        <input className="auth-input" type="email" placeholder="admin@organization.gov"
          value={form.email} onChange={set('email')} autoComplete="email" />
      </Field>
      <Field label="Password">
        <input className="auth-input" type="password" placeholder="Password"
          value={form.password} onChange={set('password')} autoComplete="current-password" />
      </Field>
      <button type="submit" className="auth-btn" disabled={loading}>
        {loading ? 'Authenticating...' : 'Login'}
      </button>
    </form>
  );
}

function AdminRegisterForm() {
  const { login } = useAuth();
  const [form, setForm] = useState({ orgName: '', name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((er) => ({ ...er, [k]: '' })); };

  const validate = () => {
    const errs = {};
    if (!form.orgName.trim())              errs.orgName = 'Required';
    if (!form.name.trim())                 errs.name = 'Required';
    if (!form.email.includes('@'))         errs.email = 'Valid email required';
    if (form.password.length < 8)          errs.password = 'Min 8 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    return errs;
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setError(''); setSuccess(''); setLoading(true);
    try {
      const data = await registerAdmin({ name: form.name, email: form.email, password: form.password, orgName: form.orgName });
      login({ id: data.user_id, name: data.user_name, role: 'admin' }, data.access_token);
    } catch (err) {
      setError(err.message.toUpperCase());
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} noValidate>
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className={styles.sectionLabel}>Organization</div>
      <Field label="Organization Name" error={errors.orgName}>
        <input className="auth-input" placeholder="e.g. Karnataka State Police"
          value={form.orgName} onChange={set('orgName')} />
      </Field>

      <div className={styles.sectionLabel} style={{ marginTop: 8 }}>Admin Account</div>
      <Field label="Full Name" error={errors.name}>
        <input className="auth-input" placeholder="Full name"
          value={form.name} onChange={set('name')} autoComplete="name" />
      </Field>
      <Field label="Email" error={errors.email}>
        <input className="auth-input" type="email" placeholder="admin@organization.gov"
          value={form.email} onChange={set('email')} autoComplete="email" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Password" error={errors.password}>
          <input className="auth-input" type="password" placeholder="Min 8 chars"
            value={form.password} onChange={set('password')} autoComplete="new-password" />
        </Field>
        <Field label="Confirm" error={errors.confirmPassword}>
          <input className="auth-input" type="password" placeholder="Repeat"
            value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" />
        </Field>
      </div>
      <button type="submit" className="auth-btn" disabled={loading}>
        {loading ? 'Registering...' : 'Register Organization'}
      </button>
      <div className="auth-note">One organization per registration.</div>
    </form>
  );
}

export function AdminAuthForm() {
  const [tab, setTab] = useState('login');
  return (
    <div>
      <div className={styles.tabs}>
        {['login', 'register'].map((t) => (
          <button key={t} type="button"
            className={`${styles.tab} ${tab === t ? styles.active : ''}`}
            onClick={() => setTab(t)}>
            {t === 'login' ? 'Login' : 'Register Org'}
          </button>
        ))}
      </div>
      <div className="animate-fade" key={tab}>
        {tab === 'login' ? <AdminLoginForm /> : <AdminRegisterForm />}
      </div>
    </div>
  );
}

