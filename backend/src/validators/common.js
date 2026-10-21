import { z } from 'zod';
import { passwordPolicyFailures } from '../services/password.service.js';

export const uuidSchema = z.uuid();

/** Senha nova: precisa cumprir a política (mesmas regras da tela de troca de senha). */
export const newPasswordSchema = z.string().superRefine((value, ctx) => {
  for (const message of passwordPolicyFailures(value)) {
    ctx.addIssue({ code: 'custom', message });
  }
});
