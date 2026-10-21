import { hasPermission } from '../config/permissions.js';
import { forbidden } from '../utils/http-error.js';

/** Permite a rota se o usuário tiver QUALQUER uma das permissões listadas. */
export function requirePermission(...permissions) {
  return (req, _res, next) => {
    if (permissions.some((permission) => hasPermission(req.user, permission))) return next();
    return next(forbidden());
  };
}
