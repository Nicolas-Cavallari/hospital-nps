import { request } from './api.js';

/**
 * API pública da pesquisa (sem login). O token da avaliação é entregue ao iniciar e enviado
 * no cabeçalho das chamadas seguintes; fica só na memória da página.
 */
const tokenHeader = (session) => ({ 'X-Evaluation-Token': session.token });
const evaluationPath = (session) => `/api/public/evaluations/${session.id}`;

export const fetchSurvey = (slug) => request('GET', `/api/public/surveys/${encodeURIComponent(slug)}`);

export const createEvaluation = (slug, visit) =>
  request('POST', `/api/public/surveys/${encodeURIComponent(slug)}/evaluations`, visit);

export const updateVisit = (session, visit) =>
  request('PUT', `${evaluationPath(session)}/visit`, visit, tokenHeader(session));

export const saveAnswer = (session, questionId, answer) =>
  request('PUT', `${evaluationPath(session)}/answers/${questionId}`, answer, tokenHeader(session));

export const finishEvaluation = (session, feedback) =>
  request('POST', `${evaluationPath(session)}/finish`, feedback ? { feedback } : {}, tokenHeader(session));
