import * as usersService from '../services/users.service.js';
import { createUserSchema, updateUserSchema } from '../validators/users.validator.js';

// Respostas com senha temporária não devem ser guardadas em cache.
const noStore = (res) => res.set('Cache-Control', 'no-store');

export async function list(_req, res) {
  res.json({ users: await usersService.listUsers() });
}

export async function get(req, res) {
  res.json({ user: await usersService.getUser(req.params.id) });
}

export async function create(req, res) {
  const input = createUserSchema.parse(req.body);
  const result = await usersService.createUser(input);
  noStore(res).status(201).json(result);
}

export async function update(req, res) {
  const input = updateUserSchema.parse(req.body);
  res.json({ user: await usersService.updateUser(req.user, req.params.id, input) });
}

export async function resetPassword(req, res) {
  const result = await usersService.resetPassword(req.user, req.params.id);
  noStore(res).json(result);
}
