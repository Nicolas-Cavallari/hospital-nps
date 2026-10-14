import { createApp } from './app.js';
import { closePool, isDatabaseConfigured } from './config/db.js';
import { env } from './config/env.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[api] rodando em http://localhost:${env.port} (${env.nodeEnv})`);
  if (!isDatabaseConfigured()) {
    console.warn('[api] DATABASE_URL não configurada: /api/health/db responderá 503.');
  }
});

async function shutdown(signal) {
  console.log(`[api] ${signal} recebido, encerrando...`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
