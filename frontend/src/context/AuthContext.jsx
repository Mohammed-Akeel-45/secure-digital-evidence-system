import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

// Decode JWT payload without a library
export function decodeJWT(token) {
    if (!token) return null;
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch {
            return null;
        }
    }
}

function loadStoredAuth() {
    const token = localStorage.getItem('sdes_token');
    const raw = localStorage.getItem('sdes_user');
    if (!token || !raw) return { token: null, user: null };

    // Check expiry
    const claims = decodeJWT(token);
    if (claims?.exp && Date.now() / 1000 > claims.exp) {
        localStorage.removeItem('sdes_token');
        localStorage.removeItem('sdes_user');
        return { token: null, user: null };
    }

    return { token, user: JSON.parse(raw) };
}

export function AuthProvider({ children }) {
    const stored = loadStoredAuth();
    const [token, setToken] = useState(stored.token);
    const [user, setUser] = useState(stored.user);

    const login = useCallback((userData, accessToken) => {
        localStorage.setItem('sdes_token', accessToken);
        localStorage.setItem('sdes_user', JSON.stringify(userData));
        setToken(accessToken);
        setUser(userData);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('sdes_token');
        localStorage.removeItem('sdes_user');
        setToken(null);
        setUser(null);
    }, []);

    const isAdmin = user?.role === 'admin';

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAdmin, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
