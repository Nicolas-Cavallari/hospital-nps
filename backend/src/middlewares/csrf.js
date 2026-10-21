import { forbidden } from '../utils/http-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-csrf-protection';

/**
 * Proteção contra CSRF para quem usa cookie de sessão: operações que alteram dados precisam
 * enviar um cabeçalho próprio. Páginas de outros sites não conseguem enviá-lo (o navegador exigiria
 * liberação de CORS, que este servidor não concede). O cookie também é SameSite=Lax.
 */
export function requireCsrfHeader(req, _res, next) {
  if (SAFE_METHODS.has(req.method) || req.get(CSRF_HEADER) === '1') return next();
  return next(forbidden('Requisição não autorizada.', { code: 'CSRF' }));
}
