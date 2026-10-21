import { z } from 'zod';
import { ROLES } from '../config/permissions.js';

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,50}$/, 'Use de 3 a 50 caracteres: letras, números, ponto, hífen ou sublinhado.');

const fullNameSchema = z.string().trim().min(1, 'Informe o nome.').max(150);

export const createUserSchema = z
  .object({
    username: usernameSchema,
    fullName: fullNameSchema,
    role: z.enum(Object.values(ROLES)),
    sectorId: z.uuid().optional(),
  })
  .superRefine((value, ctx) => {
    const isGestor = value.role === ROLES.GESTOR;
    if (isGestor && !value.sectorId) {
      ctx.addIssue({ code: 'custom', path: ['sectorId'], message: 'O gestor precisa de um setor.' });
    }
    if (!isGestor && value.sectorId) {
      ctx.addIssue({ code: 'custom', path: ['sectorId'], message: 'Somente o gestor é vinculado a um setor.' });
    }
  });

export const updateUserSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    sectorId: z.uuid().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Informe ao menos um campo.' });
