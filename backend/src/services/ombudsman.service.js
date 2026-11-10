import { withTransaction } from '../config/db.js';
import * as repository from '../repositories/ombudsman.repository.js';
import { badRequest, conflict, notFound } from '../utils/http-error.js';
import { uuidSchema } from '../validators/common.js';

export const listCases = (page) => repository.list(page);
async function requireCase(id, tx, lock) {
  if (!uuidSchema.safeParse(id).success) throw notFound();
  const item = await repository.find(id, tx, lock);
  if (!item) throw notFound();
  return item;
}
export async function getCase(id) {
  return withTransaction(async (tx) => {
    const item = await requireCase(id, tx, true);
    return { ...item, ...await repository.history(id, tx) };
  });
}
export async function handleCase(actor, id, operation, input) {
  return withTransaction(async (tx) => {
    const item = await requireCase(id, tx, true);
    if (item.status !== 'open') throw conflict('Atendimento encerrado não pode ser alterado nem reaberto.');
    if (operation === 'attempt') {
      if (!item.contactRequested) throw badRequest('Atendimento anônimo não permite tentativas de contato.');
      await repository.insertAttempt(id, actor, input, tx);
    } else if (operation === 'action') {
      await repository.insertAction(id, actor, input, tx);
    } else if (operation === 'close') {
      await repository.close(id, actor, tx);
    } else throw badRequest('Operação inválida.');
    return { ...await repository.find(id, tx), ...await repository.history(id, tx) };
  });
}
