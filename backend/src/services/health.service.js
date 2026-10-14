import { pingDatabase } from '../repositories/health.repository.js';

export function getApiStatus() {
  return {
    status: 'ok',
    service: 'hospital-nps-backend',
    time: new Date().toISOString(),
  };
}

export async function getDatabaseStatus() {
  const result = await pingDatabase();

  if (result.ok) {
    return { httpStatus: 200, body: { status: 'ok', database: 'ok' } };
  }

  return {
    httpStatus: 503,
    body: { status: 'error', database: result.reason },
  };
}
