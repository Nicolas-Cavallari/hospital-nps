import { isAuthConfigured } from '../config/env.js';
import * as usersRepository from '../repositories/users.repository.js';
import { HttpError, badRequest, unauthorized } from '../utils/http-error.js';
import { DUMMY_HASH_PROMISE, hashPassword, verifyPassword } from './password.service.js';
import { signSession } from './token.service.js';
import { toPublicUser } from './user.mapper.js';

export function assertAuthConfigured() {
  if (!isAuthConfigured()) {
    throw new HttpError(503, 'Autenticação indisponível no momento.');
  }
}

/**
 * Valida as credenciais. A mesma resposta é dada para usuário inexistente, conta desativada
 * e senha errada, para não revelar quais contas existem.
 */
export async function login({ username, password, remember }) {
  assertAuthConfigured();

  const row = await usersRepository.findByUsername(username.toLowerCase());
  const hash = row ? row.password_hash : await DUMMY_HASH_PROMISE;
  const passwordOk = await verifyPassword(hash, password);

  if (!row || !row.is_active || !passwordOk) {
    throw unauthorized('Não foi possível entrar. Confira o usuário e a senha.');
  }

  return {
    user: toPublicUser(row),
    token: signSession({ id: row.id, tokenVersion: row.token_version }, { remember }),
  };
}

/**
 * Troca a senha do próprio usuário. Na troca obrigatória (senha temporária) não se pede a senha
 * atual, pois a pessoa acabou de entrar com ela; nas demais, a senha atual é exigida.
 * As sessões anteriores deixam de valer; devolve uma nova sessão para quem trocou.
 */
export async function changePassword(userId, { currentPassword, newPassword, remember }) {
  assertAuthConfigured();

  const row = await usersRepository.findById(userId);
  if (!row || !row.is_active) throw unauthorized();

  if (!row.must_change_password) {
    const currentOk = currentPassword ? await verifyPassword(row.password_hash, currentPassword) : false;
    if (!currentOk) throw badRequest('Senha atual incorreta.');
  }
  if (await verifyPassword(row.password_hash, newPassword)) {
    throw badRequest('A nova senha deve ser diferente da senha atual.');
  }

  const updated = await usersRepository.setPassword(userId, {
    passwordHash: await hashPassword(newPassword),
    mustChangePassword: false,
  });

  return {
    user: toPublicUser(updated),
    token: signSession({ id: updated.id, tokenVersion: updated.token_version }, { remember }),
  };
}
