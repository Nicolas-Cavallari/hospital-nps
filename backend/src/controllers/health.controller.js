import { getApiStatus, getDatabaseStatus } from '../services/health.service.js';

export function apiHealth(_req, res) {
  res.json(getApiStatus());
}

export async function databaseHealth(_req, res, next) {
  try {
    const { httpStatus, body } = await getDatabaseStatus();
    res.status(httpStatus).json(body);
  } catch (err) {
    next(err);
  }
}
