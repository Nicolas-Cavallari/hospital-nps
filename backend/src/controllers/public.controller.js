import * as evaluationsService from '../services/evaluations.service.js';
import * as surveyService from '../services/survey.service.js';
import { answerSchema, finishSchema, visitSchema } from '../validators/public.validator.js';

const tokenOf = (req) => req.get('x-evaluation-token');

export async function getSurvey(req, res) {
  res.json(await surveyService.getSurvey(req.params.slug));
}

export async function createEvaluation(req, res) {
  const visit = visitSchema.parse(req.body);
  res.status(201).json(await evaluationsService.createEvaluation(req.params.slug, visit));
}

export async function updateVisit(req, res) {
  const visit = visitSchema.parse(req.body);
  res.json(await evaluationsService.updateVisit(req.params.id, tokenOf(req), visit));
}

export async function saveAnswer(req, res) {
  const input = answerSchema.parse(req.body);
  res.json(await evaluationsService.saveAnswer(req.params.id, tokenOf(req), req.params.questionId, input));
}

export async function finish(req, res) {
  const input = finishSchema.parse(req.body ?? {});
  res.json(await evaluationsService.finish(req.params.id, tokenOf(req), input));
}
