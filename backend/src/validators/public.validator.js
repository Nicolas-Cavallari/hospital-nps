import { z } from 'zod';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.');
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.').refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}, 'Data inválida.');

export const visitSchema = z
  .object({
    visitDate: dateSchema,
    visitTime: timeSchema.optional(),
    shiftId: z.uuid().optional(),
  })
  .refine((value) => value.visitTime || value.shiftId, {
    message: 'Informe o horário ou selecione o turno.',
    path: ['visitTime'],
  });

export const answerSchema = z.union([
  z.object({ value: z.number().int().min(0).max(10) }),
  z.object({ skipped: z.literal(true) }),
]);

const FEEDBACK_TYPES = ['elogio', 'reclamacao', 'sugestao', 'outro'];

export const feedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES).optional(),
  message: z.string().max(1000),
  contactRequested: z.boolean(),
  phone: z.string().regex(/^[1-9]{2}9\d{8}$/, 'Celular inválido.').optional(),
  consent: z.boolean().optional(),
});

export const finishSchema = z.object({ feedback: feedbackSchema.optional() }).default({});

export const privacyUrlSchema = z.object({
  url: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Informe um endereço http ou https válido.')
    .nullable(),
});
