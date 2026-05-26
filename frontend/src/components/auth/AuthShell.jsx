import styles from './AuthShell.module.css';

export function AuthShell({ children }) {
  return (
    <div className={styles.root}>
      <div className={styles.inner}>{children}</div>
    </div>
  );
}

export function Logo() {
  return (
    <div style={{ marginBottom: 36, paddingBottom: 24, borderBottom: '1px solid #222' }}>
      <div style={{
        fontFamily: "'Stardom', serif",
        fontSize: 26,
        color: '#fff',
        letterSpacing: '0.04em',
        marginBottom: 5,
        lineHeight: 1,
      }}>
        SDES
      </div>
      <div style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        color: '#555',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        Secure Digital Evidence System
      </div>
    </div>
  );
}

