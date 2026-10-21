import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../services/auth.js';

const AuthContext = createContext(null);

const LOADING = { status: 'loading', user: null };
const ANONYMOUS = { status: 'anonymous', user: null };
const authenticated = (user) => ({ status: 'authenticated', user });

const NETWORK_ERROR = 'Não foi possível conectar ao servidor. Tente novamente.';

/**
 * Estado de login da área privada. A fonte da verdade é o backend (GET /api/auth/me);
 * esconder telas aqui é só conveniência: toda operação protegida é verificada de novo no servidor.
 * Envolve apenas as telas privadas, então a pesquisa pública nunca consulta a sessão.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState(LOADING);

  useEffect(() => {
    let active = true;
    authApi
      .fetchSession()
      .then((result) => {
        if (active) setState(result.ok ? authenticated(result.body.user) : ANONYMOUS);
      })
      .catch(() => {
        if (active) setState(ANONYMOUS);
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (username, password, remember) => {
    try {
      const result = await authApi.login(username, password, remember);
      if (result.ok) {
        setState(authenticated(result.body.user));
        return { ok: true, user: result.body.user };
      }
      // Só o 503 (login indisponível) mostra a mensagem do servidor; credenciais ruins são sempre genéricas.
      return { ok: false, message: result.status === 503 ? result.body?.error : undefined };
    } catch {
      return { ok: false, message: NETWORK_ERROR };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setState(ANONYMOUS);
    }
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    try {
      const result = await authApi.changePassword(newPassword);
      if (result.ok) {
        setState(authenticated(result.body.user));
        return { ok: true };
      }
      if (result.status === 401) {
        setState(ANONYMOUS); // sessão expirou: volta para o login
        return { ok: false, message: 'Sua sessão expirou. Entre novamente.' };
      }
      return { ok: false, message: result.body?.error ?? 'Não foi possível salvar a nova senha.' };
    } catch {
      return { ok: false, message: NETWORK_ERROR };
    }
  }, []);

  const value = useMemo(
    () => ({ ...state, signIn, signOut, updatePassword }),
    [state, signIn, signOut, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return context;
}
