import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number.parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL?.trim() || null,
  dbSsl: (process.env.DB_SSL ?? 'true').toLowerCase() === 'true',
  dbSslCaPath: process.env.DB_SSL_CA_PATH?.trim() || null,
};
