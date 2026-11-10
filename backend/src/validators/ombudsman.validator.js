import { z } from 'zod';

export const attemptSchema = z.object({
  outcome: z.enum(['no_answer', 'answered']),
  wantsToContinue: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.outcome === 'answered') !== (value.wantsToContinue !== undefined)) {
    ctx.addIssue({ code: 'custom', message: 'Informe o interesse em continuar somente quando a pessoa atender.' });
  }
});
export const actionSchema = z.object({ description: z.string().trim().min(1).max(2000) }).strict();
// O contato sem sucesso é registrado automaticamente na terceira tentativa sem resposta.
export const closeSchema = z.object({}).strict();
export const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();
