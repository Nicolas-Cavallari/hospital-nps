import { withTransaction } from '../config/db.js';
import { ROLES } from '../config/permissions.js';
import * as sectorsRepository from '../repositories/sectors.repository.js';
import * as usersRepository from '../repositories/users.repository.js';
import { badRequest, conflict, notFound } from '../utils/http-error.js';
import { generateTemporaryPassword, hashPassword } from './password.service.js';
import { toAdminUser } from './user.mapper.js';
import { uuidSchema } from '../validators/common.js';

const isUuid = (value) => uuidSchema.safeParse(value).success;

function mapDatabaseError(err) {
  if (err.code === '23505') return conflict('Já existe um usuário com esse nome de usuário.');
  if (err.code === '23503') return badRequest('Setor inválido.');
  if (err.code === '23514') return badRequest('Dados inválidos.');
  return err;
}

export async function listUsers() {
  return (await usersRepository.list()).map(toAdminUser);
}

export async function getUser(id) {
  if (!isUuid(id)) throw notFound();
  const row = await usersRepository.findById(id);
  if (!row) throw notFound();
  return toAdminUser(row);
}

/**
 * Cria um usuário interno com SENHA TEMPORÁRIA. A senha é devolvida uma única vez, na resposta;
 * no banco fica apenas o hash, e o usuário é obrigado a trocá-la no primeiro acesso.
 */
export async function createUser({ username, fullName, role, sectorId }) {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    const row = await usersRepository.insert({ username, fullName, role, sectorId, passwordHash });
    return { user: toAdminUser(row), temporaryPassword };
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

export async function updateUser(actor, id, input) {
  if (!isUuid(id)) throw notFound();

  return withTransaction(async (tx) => {
    const target = await usersRepository.findByIdForUpdate(id, tx);
    if (!target) throw notFound();

    if (input.sectorId !== undefined && target.role !== ROLES.GESTOR) {
      throw badRequest('Somente o gestor é vinculado a um setor.');
    }

    if (input.isActive === false && target.is_active) {
      if (target.id === actor.id) throw badRequest('Você não pode desativar a própria conta.');
      if (target.role === ROLES.SUPER_ADMIN) {
        await usersRepository.lockActiveSuperAdmins(tx);
        if ((await usersRepository.countActiveSuperAdminsExcept(id, tx)) === 0) {
          throw badRequest('É necessário manter ao menos um Super Admin ativo.');
        }
      }
    }

    try {
      return toAdminUser(await usersRepository.update(id, input, tx));
    } catch (err) {
      throw mapDatabaseError(err);
    }
  });
}

/** Gera uma nova senha temporária (o usuário terá de trocá-la) e derruba as sessões dele. */
export async function resetPassword(actor, id) {
  if (!isUuid(id)) throw notFound();
  const target = await usersRepository.findById(id);
  if (!target) throw notFound();
  if (target.id === actor.id) {
    throw badRequest('Para trocar a sua própria senha, use a troca de senha da sua conta.');
  }

  const temporaryPassword = generateTemporaryPassword();
  const updated = await usersRepository.setPassword(id, {
    passwordHash: await hashPassword(temporaryPassword),
    mustChangePassword: true,
  });
  return { user: toAdminUser(updated), temporaryPassword };
}

/** Usado pelo comando de linha de comando para vincular um gestor a um setor pelo slug. */
export async function findSectorIdBySlug(slug) {
  return (await sectorsRepository.findBySlug(slug))?.id ?? null;
}
