import styles from './RoleSelector.module.css';

export function RoleSelector({ value, onChange }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.label}>Access Level</div>
      <div className={styles.tabs}>
        {['user', 'admin'].map((role) => (
          <button
            key={role}
            type="button"
            className={`${styles.tab} ${value === role ? styles.active : ''}`}
            onClick={() => onChange(role)}
          >
            <span className={styles.indicator} />
            {role === 'user' ? 'Officer / User' : 'Administrator'}
          </button>
        ))}
      </div>
      <div className={styles.hint}>
        {value === 'user'
          ? 'Login with credentials provided by your administrator.'
          : 'Register your organization or login as admin.'}
      </div>
    </div>
  );
}
