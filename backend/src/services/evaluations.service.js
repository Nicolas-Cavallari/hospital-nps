import { createHash, randomBytes } from 'node:crypto';
import { withTransaction } from '../config/db.js';
import * as evaluationsRepository from '../repositories/evaluations.repository.js';
import * as surveysRepository from '../repositories/surveys.repository.js';
import { HttpError, badRequest, conflict, notFound } from '../utils/http-error.js';
import { uuidSchema } from '../validators/common.js';
import { pickTeam, resolveShift } from './shift-team.service.js';
import { surveyUnavailable } from './survey.service.js';

const sha256 = (value) => createHash('sha256').update(value).digest();
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{20,100}$/;
const isUuid = (value) => uuidSchema.safeParse(value).success;

const evaluationNotFound = () => notFound('Avaliação não encontrada.');

/** Data de hoje no fuso do hospital (AAAA-MM-DD). */
const todayInBrazil = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

/** Erros do banco que escapam das validações (ex.: corrida com a finalização) viram respostas seguras. */
function mapDatabaseError(err) {
  if (err.code === '23000') return conflict('Não foi possível registrar: a avaliação foi alterada ou finalizada.');
  if (err.code === '23503' || err.code === '23514') return badRequest('Dados inválidos.');
  return err;
}

/**
 * O respondente só alcança a PRÓPRIA avaliação: é preciso o id e o token entregue na criação.
 * Id inexistente, token errado ou ausente: sempre a mesma resposta.
 */
async function loadEvaluation(id, token, { lock = false } = {}, db) {
  if (!isUuid(id) || typeof token !== 'string' || !TOKEN_FORMAT.test(token)) throw evaluationNotFound();
  const row = await evaluationsRepository.findByIdAndToken(id, sha256(token), { lock }, db);
  if (!row) throw evaluationNotFound();
  return row;
}

async function assertOpen(evaluation, db) {
  if (evaluation.status === 'completed') throw conflict('Esta avaliação já foi finalizada.');
  const sector = await surveysRepository.findSectorById(evaluation.sector_id, db);
  if (!sector?.is_active) {
    throw new HttpError(409, 'Esta pesquisa não está mais aceitando respostas.', { code: 'SURVEY_UNAVAILABLE' });
  }
}

async function resolveVisit(sectorId, visit, db) {
  if (visit.visitDate > todayInBrazil()) throw badRequest('A data do atendimento não pode ser futura.');

  const shifts = await surveysRepository.listActiveShifts(db);
  const resolved = resolveShift({ shifts, chosenShiftId: visit.shiftId, visitTime: visit.visitTime });
  if (resolved.invalidChoice) throw badRequest('Turno inválido.');

  const shift = resolved.shift ?? null;
  const teams = shift ? await surveysRepository.listActiveTeams(sectorId, shift.id, db) : [];
  return {
    visitDate: visit.visitDate,
    visitTime: visit.visitTime ?? null,
    shiftId: shift?.id ?? null,
    teamId: pickTeam(teams),
  };
}

const toEvaluation = (row) => ({ id: row.id, shiftId: row.shift_id });

/** Inicia a avaliação. O token só existe aqui: no banco fica apenas o seu SHA-256. */
export async function createEvaluation(slug, visit) {
  const sector = await surveysRepository.findSectorBySlug(slug);
  if (!sector || !sector.is_active || !(await surveysRepository.findActiveNpsQuestion())) {
    throw surveyUnavailable();
  }

  const resolved = await resolveVisit(sector.id, visit);
  const accessToken = randomBytes(32).toString('base64url');
  try {
    const row = await evaluationsRepository.insert({
      sectorId: sector.id,
      ...resolved,
      tokenHash: sha256(accessToken),
    });
    return { evaluation: toEvaluation(row), accessToken };
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

/** Corrige data/horário/turno enquanto a avaliação está em andamento (botão Voltar). */
export async function updateVisit(id, token, visit) {
  const evaluation = await loadEvaluation(id, token);
  await assertOpen(evaluation);
  const resolved = await resolveVisit(evaluation.sector_id, visit);
  try {
    return { evaluation: toEvaluation(await evaluationsRepository.updateVisit(id, resolved)) };
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

/** Salva (ou corrige) a resposta de UMA pergunta. Obrigatórias não podem ser puladas. */
export async function saveAnswer(id, token, questionId, input) {
  const evaluation = await loadEvaluation(id, token);
  await assertOpen(evaluation);

  const question = isUuid(questionId)
    ? await surveysRepository.findAnswerableQuestion(questionId, evaluation.sector_id)
    : null;
  if (!question) throw badRequest('Pergunta inválida.');

  const skipped = 'skipped' in input;
  if (skipped && (question.is_required || question.is_nps)) {
    throw badRequest('Esta pergunta é obrigatória e não pode ser pulada.', { code: 'REQUIRED_QUESTION' });
  }
  if (!skipped && !(await surveysRepository.findActiveOption(question.id, input.value))) {
    throw badRequest('Resposta inválida.');
  }

  try {
    const answer = await evaluationsRepository.upsertAnswer({
      evaluationId: evaluation.id,
      questionId: question.id,
      value: skipped ? null : input.value,
      skipped,
    });
    return { answer: { questionId: answer.question_id, value: answer.value, skipped: answer.skipped } };
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

/**
 * Conclui a avaliação. Exige a nota de NPS e as perguntas obrigatórias respondidas.
 * O feedback é opcional e só existe para notas de 0 a 6; se vier, gera o atendimento da ouvidoria
 * na mesma transação. Sem feedback, a pesquisa conclui normalmente.
 */
export async function finish(id, token, { feedback } = {}) {
  try {
    return await withTransaction(async (tx) => {
      const evaluation = await loadEvaluation(id, token, { lock: true }, tx);
      await assertOpen(evaluation, tx);

      if (evaluation.nps_score === null) {
        throw badRequest('Responda à pergunta de avaliação geral (0 a 10) para concluir.', { code: 'NPS_REQUIRED' });
      }
      if ((await surveysRepository.countMissingRequired(evaluation.sector_id, evaluation.id, tx)) > 0) {
        throw badRequest('Há perguntas obrigatórias sem resposta.', { code: 'REQUIRED_MISSING' });
      }

      const message = feedback?.message.trim() ?? '';
      const sendFeedback = message.length > 0;

      if (sendFeedback) {
        if (evaluation.nps_score > 6) {
          throw badRequest('O envio de feedback só está disponível para notas de 0 a 6.');
        }
        if (feedback.contactRequested) {
          if (!feedback.phone) throw badRequest('Informe o celular para receber retorno.');
          if (feedback.consent !== true) {
            throw badRequest('É necessário autorizar o uso do celular para receber retorno.', { code: 'CONSENT_REQUIRED' });
          }
        } else if (feedback.phone || feedback.consent) {
          throw badRequest('Feedback anônimo não deve incluir celular nem consentimento.');
        }

        await evaluationsRepository.insertCase(
          {
            evaluationId: evaluation.id,
            feedbackType: feedback.type,
            message,
            contactRequested: feedback.contactRequested,
            phone: feedback.contactRequested ? feedback.phone : null,
            consentGiven: feedback.contactRequested,
          },
          tx,
        );
      }

      await evaluationsRepository.complete(evaluation.id, tx);
      return { completed: true, feedbackSent: sendFeedback };
    });
  } catch (err) {
    throw mapDatabaseError(err);
  }
}
