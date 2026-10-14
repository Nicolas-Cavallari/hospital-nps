/**
 * Cliente mínimo da API. Todas as chamadas usam caminhos relativos ("/api/...").
 * No desenvolvimento, o Vite repassa essas chamadas ao backend (ver vite.config.js).
 */
async function getJson(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });

  let body = null;
  try {
    body = await response.json();
  } catch {
    // resposta sem JSON (ex.: proxy sem backend); body permanece nulo
  }

  return { ok: response.ok, status: response.status, body };
}

export function getApiHealth() {
  return getJson('/api/health');
}

export function getDatabaseHealth() {
  return getJson('/api/health/db');
}
