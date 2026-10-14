import { getPool, isDatabaseConfigured } from '../config/db.js';

/**
 * Executa uma consulta mínima para confirmar que o banco responde.
 * Retorna sempre um objeto simples; nunca expõe detalhes da conexão.
 */
export async function pingDatabase() {
  if (!isDatabaseConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }

  try {
    await getPool().query('SELECT 1');
    return { ok: true };
  } catch (err) {
    console.error('[db] falha na verificação do banco:', err.message);
    return { ok: false, reason: 'unreachable' };
  }
}
