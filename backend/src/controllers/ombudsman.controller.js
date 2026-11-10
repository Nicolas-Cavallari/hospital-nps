import * as service from '../services/ombudsman.service.js';
import { attemptSchema, actionSchema, closeSchema, listSchema } from '../validators/ombudsman.validator.js';

export async function list(req, res) {
  const { page } = listSchema.parse(req.query);
  res.json({ cases: await service.listCases(page), page });
}
export async function get(req, res) {
  res.json({ case: await service.getCase(req.params.id) });
}
export const mutate = (operation, schema) => async (req, res) => {
  const input = schema.parse(req.body);
  const item = await service.handleCase(req.user, req.params.id, operation, input);
  res.status(operation === 'close' ? 200 : 201).json({ case: item });
};
export const attempt = mutate('attempt', attemptSchema);
export const action = mutate('action', actionSchema);
export const close = mutate('close', closeSchema);
