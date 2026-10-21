import { z } from 'zod';
import { newPasswordSchema } from './common.js';

// No login, o formato do usuário não é validado de propósito: não ensina o que é "válido".
export const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(256),
  remember: z.boolean().optional().default(false),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256).optional(),
  newPassword: newPasswordSchema,
});
