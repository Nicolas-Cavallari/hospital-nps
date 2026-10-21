import { sectorScope } from '../config/permissions.js';
import * as sectorsRepository from '../repositories/sectors.repository.js';
import { forbidden, notFound } from '../utils/http-error.js';
import { uuidSchema } from '../validators/common.js';
import { toSector } from './user.mapper.js';

const SCOPE_PERMISSIONS = { allPermission: 'sectors:read:all', ownPermission: 'sectors:read:own' };

function scopeOf(user) {
  const scope = sectorScope(user, SCOPE_PERMISSIONS);
  if (!scope) throw forbidden();
  return scope;
}

/** Super Admin e ouvidoria veem todos os setores; o gestor vê somente o seu. */
export async function listSectors(user) {
  const scope = scopeOf(user);
  if (scope.all) return (await sectorsRepository.listAll()).map(toSector);

  const own = await sectorsRepository.findById(scope.sectorId);
  return own ? [toSector(own)] : [];
}

/**
 * Setor fora do alcance do usuário responde "não encontrado", exatamente como um setor que não
 * existe: quem altera o identificador na URL não descobre quais setores existem.
 */
export async function getSector(user, id) {
  const scope = scopeOf(user);
  if (!uuidSchema.safeParse(id).success) throw notFound();
  if (!scope.all && id !== scope.sectorId) throw notFound();

  const row = await sectorsRepository.findById(id);
  if (!row) throw notFound();
  return toSector(row);
}
