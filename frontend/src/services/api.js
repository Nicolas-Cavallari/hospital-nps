/**
 * Cliente mínimo da API. Todas as chamadas usam caminhos relativos ("/api/...").
 * No desenvolvimento, o Vite repassa essas chamadas ao backend (ver vite.config.js).
 * A sessão viaja em cookie HttpOnly (o JavaScript da página nunca enxerga o token).
 */
const CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function request(method, path, body, extraHeaders = {}) {
  const headers = { Accept: 'application/json', ...extraHeaders };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  // Cabeçalho anti-CSRF exigido pelo backend nas operações que alteram dados.
  if (CHANGING_METHODS.has(method)) headers['X-CSRF-Protection'] = '1';

  const response = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // resposta sem JSON (ex.: 204 ou proxy sem backend); body permanece nulo
  }

  return { ok: response.ok, status: response.status, body: data };
}

export function getApiHealth() {
  return request('GET', '/api/health');
}

export function getDatabaseHealth() {
  return request('GET', '/api/health/db');
}
