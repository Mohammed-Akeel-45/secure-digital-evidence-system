import React, { useState } from 'react';
import { confirmable, createConfirmation } from 'react-confirm';

function ConfirmModal({ show, proceed, dismiss, title, message, expectedName, confirmText = 'Confirm', isDelete = false }) {
    const [inputVal, setInputVal] = useState('');

    if (!show) return null;

    const isMatch = !expectedName || inputVal.trim() === expectedName;

    const handleConfirm = () => {
        if (isMatch) {
            proceed(true);
        }
    };

    const handleCancel = () => {
        proceed(false);
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                background: 'rgba(12, 12, 12, 0.85)',
                backdropFilter: 'blur(10px)',
                transition: 'opacity 0.2s ease'
            }}
            onClick={handleCancel}
        >
            <div
                className="card animate-fade"
                style={{
                    width: '100%',
                    maxWidth: 440,
                    border: '1px solid var(--rule)',
                    borderRadius: 0,
                    padding: 24,
                    boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
                    background: 'var(--surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16
                }}
                onClick={e => e.stopPropagation()}
            >
                <div>
                    <div style={{
                        fontFamily: 'var(--cond)',
                        fontSize: 20,
                        fontWeight: 700,
                        color: isDelete ? '#ff5555' : 'var(--ink)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: 4
                    }}>
                        {title || 'Confirm Action'}
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)' }}>
                        SECURITY VERIFICATION REQUIREMENT
                    </div>
                </div>

                <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: '1.6' }}>
                    {message}
                </div>

                {expectedName && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <strong className="field-label" style={{ marginBottom: 0 }}>
                            TO CONFIRM, TYPE <span style={{ color: 'var(--ink)', backgroundColor: 'black', padding: '2px 4px', borderRadius: '4px' }}>{expectedName}</span> BELOW:
                        </strong>
                        <input
                            type="text"
                            className="input"
                            value={inputVal}
                            onChange={e => setInputVal(e.target.value)}
                            placeholder={expectedName}
                            style={{
                                width: '100%',
                                border: isMatch ? '1px solid var(--rule)' : '1px solid #ff5555',
                                background: 'var(--bg)',
                                color: 'var(--ink)',
                                padding: '8px 10px',
                                outline: 'none'
                            }}
                            autoFocus
                            onKeyDown={e => {
                                if (e.key === 'Enter' && isMatch) {
                                    handleConfirm();
                                }
                            }}
                        />
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                    <button
                        type="button"
                        className="btn"
                        onClick={handleCancel}
                        style={{ minWidth: 100 }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={isDelete ? 'btn btn-danger' : 'btn btn-primary'}
                        onClick={handleConfirm}
                        disabled={!isMatch}
                        style={{
                            minWidth: 100,
                            opacity: isMatch ? 1 : 0.4,
                            cursor: isMatch ? 'pointer' : 'not-allowed'
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Wrap with confirmable
export const confirmAction = createConfirmation(confirmable(ConfirmModal));
