import { request } from './api.js';

export const login = (username, password, remember) =>
  request('POST', '/api/auth/login', { username, password, remember });

export const logout = () => request('POST', '/api/auth/logout');

export const fetchSession = () => request('GET', '/api/auth/me');

export const changePassword = (newPassword) =>
  request('POST', '/api/auth/change-password', { newPassword });
