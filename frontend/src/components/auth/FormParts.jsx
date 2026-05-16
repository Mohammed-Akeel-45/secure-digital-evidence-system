export function Field({ label, error, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{
          display: 'block',
          fontFamily: "'DM Mono', monospace",
          fontSize: 9,
          color: '#555',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 5,
        }}>
          {label}
        </label>
      )}
      {children}
      {error && (
        <div style={{ fontSize: 10, color: '#c44', marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
          {error}
        </div>
      )}
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div style={{
      padding: '9px 12px',
      background: '#1a0a0a',
      border: '1px solid #3a1515',
      fontSize: 10,
      color: '#c44',
      marginBottom: 14,
      fontFamily: "'DM Mono', monospace",
      letterSpacing: '0.03em',
    }}>
      {message}
    </div>
  );
}

export function SuccessBanner({ message }) {
  if (!message) return null;
  return (
    <div style={{
      padding: '9px 12px',
      background: '#0a1a0f',
      border: '1px solid #153a22',
      fontSize: 10,
      color: '#4a4',
      marginBottom: 14,
      fontFamily: "'DM Mono', monospace",
      letterSpacing: '0.03em',
    }}>
      {message}
    </div>
  );
}

