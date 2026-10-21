import * as authService from '../services/auth.service.js';
import { SESSION_COOKIE, clearCookieOptions, sessionCookieOptions } from '../services/token.service.js';
import { changePasswordSchema, loginSchema } from '../validators/auth.validator.js';

export async function login(req, res) {
  const input = loginSchema.parse(req.body);
  const { user, token } = await authService.login(input);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions({ remember: input.remember }));
  res.json({ user });
}

export function logout(_req, res) {
  res.clearCookie(SESSION_COOKIE, clearCookieOptions());
  res.status(204).end();
}

export function me(req, res) {
  const { remember, ...user } = req.user; // "remember" é detalhe interno da sessão
  res.json({ user });
}

export async function changePassword(req, res) {
  const input = changePasswordSchema.parse(req.body);
  const { user, token } = await authService.changePassword(req.user.id, {
    ...input,
    remember: req.user.remember,
  });
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions({ remember: req.user.remember }));
  res.json({ user });
}
