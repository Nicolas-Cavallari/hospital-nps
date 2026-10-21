import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const SESSION_COOKIE = 'hnps_session';
const REMEMBER_SECONDS = 60 * 24 * 60 * 60; // "manter neste dispositivo": 60 dias
const SESSION_SECONDS = 12 * 60 * 60; // sem marcar: cookie de sessão + limite de 12 horas

export function signSession(user, { remember }) {
  return jwt.sign({ sub: user.id, tv: user.tokenVersion, rm: Boolean(remember) }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: remember ? REMEMBER_SECONDS : SESSION_SECONDS,
  });
}

/** Retorna o conteúdo do token ou null se for inválido, adulterado ou expirado. */
export function verifySession(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.tv !== 'number') return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions({ remember }) {
  return {
    httpOnly: true, // inacessível ao JavaScript da página
    sameSite: 'lax',
    secure: env.isProduction, // em produção, só trafega por HTTPS
    path: '/',
    ...(remember ? { maxAge: REMEMBER_SECONDS * 1000 } : {}), // sem maxAge: some ao fechar o navegador
  };
}

export const clearCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProduction,
  path: '/',
});
