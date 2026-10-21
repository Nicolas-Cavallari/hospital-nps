import fs from 'node:fs';
import pg from 'pg';
import { env } from './env.js';

let pool = null;

function buildSslOptions() {
  if (!env.dbSsl) return false;

  if (env.dbSslCaPath) {
    // Conexão criptografada COM verificação do servidor.
    return { ca: fs.readFileSync(env.dbSslCaPath, 'utf8'), rejectUnauthorized: true };
  }

  // Conexão criptografada, mas sem verificar o certificado do servidor.
  console.warn(
    '[db] DB_SSL_CA_PATH não definido: a conexão é criptografada, mas o servidor do banco não é verificado.',
  );
  return { rejectUnauthorized: false };
}

/** Indica se há uma string de conexão configurada. */
export function isDatabaseConfigured() {
  return env.databaseUrl !== null;
}

/** Retorna o pool de conexões (criado sob demanda). */
export function getPool() {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL não configurada.');
  }

  if (!pool) {
    pool = new pg.Pool({
      connectionString: env.databaseUrl,
      ssl: buildSslOptions(),
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });

    // Evita que um erro em conexão ociosa derrube o processo.
    pool.on('error', (err) => {
      console.error('[db] erro em conexão ociosa do pool:', err.message);
    });
  }

  return pool;
}

/** Executa `fn(client)` dentro de uma transação (commit se concluir, rollback se falhar). */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

/** Encerra o pool (usado no desligamento da aplicação). */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
