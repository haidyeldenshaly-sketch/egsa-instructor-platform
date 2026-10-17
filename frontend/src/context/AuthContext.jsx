import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { publicPost, get, post, tokens, refreshSession } from '../services/api.js';

const AuthCtx = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    (async () => {
      try { if (tokens.getRefresh()) { const r = await refreshSession(); setUser(r.user); } } catch { /* signed out */ }
      setBooting(false);
    })();
    const onUnauth = () => { tokens.clear(); setUser(null); };
    window.addEventListener('egsa:unauthorized', onUnauth);
    return () => window.removeEventListener('egsa:unauthorized', onUnauth);
  }, []);

  const login = useCallback(async (email, password) => {
    const r = await publicPost('/auth/login', { email, password });
    if (r.user.role !== 'instructor') { const e = new Error('not-instructor'); e.code = 'NOT_INSTRUCTOR'; throw e; }
    tokens.set(r.accessToken, r.refreshToken); setUser(r.user); return r.user;
  }, []);
  const logout = useCallback(async () => { try { await post('/auth/logout', { refreshToken: tokens.getRefresh() }); } catch { /* ignore */ } tokens.clear(); setUser(null); }, []);
  const reloadUser = useCallback(async () => setUser(await get('/auth/me')), []);
  const value = useMemo(() => ({ user, booting, login, logout, setUser, reloadUser }), [user, booting, login, logout, reloadUser]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
