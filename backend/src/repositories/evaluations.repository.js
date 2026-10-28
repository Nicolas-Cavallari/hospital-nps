import { getPool } from '../config/db.js';

const run = (db) => db ?? getPool();

export async function insert({ sectorId, visitDate, visitTime, shiftId, teamId, tokenHash }, db) {
  const { rows } = await run(db).query(
    `insert into public.evaluations (sector_id, visit_date, visit_time, shift_id, team_id, access_token_hash)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [sectorId, visitDate, visitTime ?? null, shiftId ?? null, teamId ?? null, tokenHash],
  );
  return rows[0];
}

/** Só encontra a avaliação se o id E o token baterem (o banco guarda apenas o hash do token). */
export async function findByIdAndToken(id, tokenHash, { lock = false } = {}, db) {
  const { rows } = await run(db).query(
    `select * from public.evaluations where id = $1 and access_token_hash = $2 ${lock ? 'for update' : ''}`,
    [id, tokenHash],
  );
  return rows[0] ?? null;
}

export async function updateVisit(id, { visitDate, visitTime, shiftId, teamId }, db) {
  const { rows } = await run(db).query(
    `update public.evaluations
        set visit_date = $2, visit_time = $3, shift_id = $4, team_id = $5
      where id = $1 returning *`,
    [id, visitDate, visitTime ?? null, shiftId ?? null, teamId ?? null],
  );
  return rows[0];
}

/** Grava a resposta; corrigir uma resposta substitui a linha (sem apagar nada). */
export async function upsertAnswer({ evaluationId, questionId, value, skipped }, db) {
  const { rows } = await run(db).query(
    `insert into public.answers (evaluation_id, question_id, value, skipped)
     values ($1, $2, $3::smallint, $4)
     on conflict (evaluation_id, question_id)
     do update set value = excluded.value, skipped = excluded.skipped
     returning question_id, value, skipped`,
    [evaluationId, questionId, skipped ? null : value, skipped],
  );
  return rows[0];
}

export async function complete(id, db) {
  const { rows } = await run(db).query(
    `update public.evaluations set status = 'completed', completed_at = now()
      where id = $1 returning *`,
    [id],
  );
  return rows[0];
}

export async function insertCase(
  { evaluationId, feedbackType, message, contactRequested, phone, consentGiven },
  db,
) {
  const { rows } = await run(db).query(
    `insert into public.ombudsman_cases
       (evaluation_id, feedback_type, message, contact_requested, phone, consent_given, consent_at)
     values ($1, $2, $3, $4, $5, $6, case when $6 then now() end)
     returning id`,
    [evaluationId, feedbackType ?? null, message, contactRequested, phone ?? null, consentGiven],
  );
  return rows[0];
}
