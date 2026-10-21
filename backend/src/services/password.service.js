import argon2 from 'argon2';
import { randomInt } from 'node:crypto';

/** Regras da senha (as mesmas exibidas na tela de troca de senha). */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export function passwordPolicyFailures(password) {
  const failures = [];
  if (password.length < PASSWORD_MIN_LENGTH) failures.push('Use no mínimo 10 caracteres.');
  if (password.length > PASSWORD_MAX_LENGTH) failures.push('Use no máximo 128 caracteres.');
  if (!(/\p{Ll}/u.test(password) && /\p{Lu}/u.test(password))) {
    failures.push('Use letra maiúscula e minúscula.');
  }
  if (!(/\p{N}/u.test(password) && /[^\p{L}\p{N}\s]/u.test(password))) {
    failures.push('Use número e caractere especial.');
  }
  return failures;
}

export const hashPassword = (password) => argon2.hash(password, { type: argon2.argon2id });

export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false; // hash inválido ou entrada malformada: trata como senha incorreta
  }
}

// Hash descartável usado quando o usuário não existe, para o tempo de resposta do login ser parecido
// nos dois casos (evita descobrir contas existentes medindo o tempo).
export const DUMMY_HASH_PROMISE = hashPassword('senha-descartavel-para-igualar-o-tempo');

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SPECIAL = '!@#$%&*?+=-';

const pick = (chars) => chars[randomInt(chars.length)];

/** Senha temporária aleatória (16 caracteres), já dentro da política de senha. */
export function generateTemporaryPassword() {
  const all = UPPER + LOWER + DIGITS + SPECIAL;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  while (chars.length < 16) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
