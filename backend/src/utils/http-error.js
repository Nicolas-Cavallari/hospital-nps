/** Erro com código HTTP e mensagem segura para ser devolvida ao cliente. */
export class HttpError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, opts) => new HttpError(400, message, opts);
export const unauthorized = (message = 'Autenticação necessária.', opts) => new HttpError(401, message, opts);
export const forbidden = (message = 'Acesso não permitido.', opts) => new HttpError(403, message, opts);
export const notFound = (message = 'Recurso não encontrado.') => new HttpError(404, message);
export const conflict = (message, opts) => new HttpError(409, message, opts);
