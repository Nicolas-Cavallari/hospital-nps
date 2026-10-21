import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number.parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL?.trim() || null,
  dbSsl: (process.env.DB_SSL ?? 'true').toLowerCase() === 'true',
  dbSslCaPath: process.env.DB_SSL_CA_PATH?.trim() || null,
  // Segredo usado para assinar as sessões. Sem ele, o login fica indisponível.
  jwtSecret: process.env.JWT_SECRET?.trim() || null,
};

export const JWT_SECRET_MIN_LENGTH = 32;

export function isAuthConfigured() {
  return env.jwtSecret !== null && env.jwtSecret.length >= JWT_SECRET_MIN_LENGTH;
}
