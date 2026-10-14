import { env } from '../config/env.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Recurso não encontrado.' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Corpo da requisição inválido.' });
  }

  console.error('[erro]', env.isProduction ? err.message : err);
  return res.status(500).json({ error: 'Erro interno do servidor.' });
}
