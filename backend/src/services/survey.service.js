import * as settingsRepository from '../repositories/settings.repository.js';
import * as surveysRepository from '../repositories/surveys.repository.js';
import { HttpError } from '../utils/http-error.js';

/** Pesquisa inexistente, desativada ou sem a pergunta de NPS: mesma resposta, sem distinguir. */
export const surveyUnavailable = () =>
  new HttpError(404, 'Esta pesquisa não está disponível no momento.', { code: 'SURVEY_UNAVAILABLE' });

const toQuestion = (row) => ({
  id: row.id,
  text: row.text,
  description: row.description,
  required: row.is_required,
  options: row.options,
});

/**
 * Monta o que o respondente vê: só o necessário para responder (perguntas e alternativas ativas
 * do setor, a pergunta de NPS, os turnos e o link legal). Nada de dados de outras pessoas.
 */
export async function getSurvey(slug) {
  const sector = await surveysRepository.findSectorBySlug(slug);
  if (!sector || !sector.is_active) throw surveyUnavailable();

  const [shifts, questions, nps, settings] = await Promise.all([
    surveysRepository.listActiveShifts(),
    surveysRepository.listSectorQuestions(sector.id),
    surveysRepository.findActiveNpsQuestion(),
    settingsRepository.get(),
  ]);
  if (!nps) throw surveyUnavailable();

  return {
    sector: { name: sector.name, slug: sector.slug },
    shifts: shifts.map((shift) => ({ id: shift.id, name: shift.name })),
    questions: questions.map(toQuestion),
    nps: toQuestion(nps),
    privacyPolicyUrl: settings?.privacy_policy_url ?? null,
  };
}
