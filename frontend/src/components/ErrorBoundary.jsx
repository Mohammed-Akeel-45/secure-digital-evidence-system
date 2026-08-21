import React from 'react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: 32,
                    color: '#ff4444',
                    fontFamily: 'monospace',
                    background: 'rgba(255,68,68,0.05)',
                    border: '1px solid rgba(255,68,68,0.3)',
                    margin: 16,
                    borderRadius: 4
                }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>⚠ PAGE RENDER ERROR</div>
                    <div style={{ fontSize: 11, color: '#ff8888', whiteSpace: 'pre-wrap' }}>
                        {this.state.error?.message}
                    </div>
                    <button
                        style={{ marginTop: 16, padding: '6px 16px', background: 'transparent', border: '1px solid #ff4444', color: '#ff4444', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}
                        onClick={() => this.setState({ hasError: false, error: null })}
                    >
                        RETRY
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
