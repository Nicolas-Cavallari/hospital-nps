import * as usersRepository from '../repositories/users.repository.js';
import { assertAuthConfigured } from '../services/auth.service.js';
import { SESSION_COOKIE, clearCookieOptions, verifySession } from '../services/token.service.js';
import { forbidden, unauthorized } from '../utils/http-error.js';

/**
 * Exige uma sessão válida. A cada requisição o usuário é relido do banco, então desativar a conta,
 * trocar a senha ou mudar o setor vale imediatamente (sem esperar o token expirar).
 * Todas as falhas respondem do mesmo jeito (401), sem dizer o motivo.
 */
export async function authenticate(req, res, next) {
  assertAuthConfigured();

  const token = req.cookies?.[SESSION_COOKIE];
  const payload = token ? verifySession(token) : null;
  const row = payload ? await usersRepository.findById(payload.sub) : null;

  if (!row || !row.is_active || row.token_version !== payload.tv) {
    if (token) res.clearCookie(SESSION_COOKIE, clearCookieOptions());
    return next(unauthorized());
  }

  req.user = {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    sectorId: row.sector_id,
    mustChangePassword: row.must_change_password,
    remember: payload.rm === true,
  };
  return next();
}

/** Enquanto a senha temporária não for trocada, o usuário só alcança "me", "trocar senha" e "sair". */
export function requirePasswordChanged(req, _res, next) {
  if (req.user?.mustChangePassword) {
    return next(forbidden('É necessário trocar a senha temporária.', { code: 'PASSWORD_CHANGE_REQUIRED' }));
  }
  return next();
}
