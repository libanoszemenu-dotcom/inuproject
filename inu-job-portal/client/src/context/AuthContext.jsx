import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, ask the server who we are (the cookie is sent automatically).
  useEffect(() => {
    let ignore = false;
    api
      .get('/auth/me')
      .then((res) => { if (!ignore) setUser(res.data.data); })
      .catch(() => { if (!ignore) setUser(null); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.data.data);
    return res.data.data;
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const res = await api.post('/auth/google', { credential });
    setUser(res.data.data);
    return res.data.data;
  }, []);

  const refresh = useCallback(async () => {
    const res = await api.get('/auth/me');
    setUser(res.data.data);
  }, []);

  const register = useCallback(async (payload) => {
    const res = await api.post('/auth/register', payload);
    setUser(res.data.data);
    return res.data.data;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally { setUser(null); }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, loginWithGoogle, refresh, register, logout }),
    [user, loading, login, loginWithGoogle, refresh, register, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
