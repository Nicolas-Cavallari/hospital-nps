import { getPool } from '../config/db.js';

const run = (db) => db ?? getPool();

export async function findSectorBySlug(slug, db) {
  const { rows } = await run(db).query('select * from public.sectors where slug = $1', [slug]);
  return rows[0] ?? null;
}

export async function findSectorById(id, db) {
  const { rows } = await run(db).query('select * from public.sectors where id = $1', [id]);
  return rows[0] ?? null;
}

export async function listActiveShifts(db) {
  const { rows } = await run(db).query(
    'select * from public.shifts where is_active order by start_time, name',
  );
  return rows;
}

export async function listActiveTeams(sectorId, shiftId, db) {
  const { rows } = await run(db).query(
    'select id from public.teams where is_active and sector_id = $1 and shift_id = $2',
    [sectorId, shiftId],
  );
  return rows;
}

// Perguntas ativas (do setor ou a de NPS) com suas alternativas ativas. Pergunta sem nenhuma
// alternativa ativa fica de fora: não teria como ser respondida.
const QUESTIONS_SQL = `
  select q.id, q.text, q.description, q.is_required, q.is_nps,
         json_agg(json_build_object('value', o.value, 'label', o.label) order by o.value) as options
    from public.questions q
    join public.question_options o on o.question_id = q.id and o.is_active
   where q.is_active and %WHERE%
   group by q.id
   order by q.position, q.created_at`;

export async function listSectorQuestions(sectorId, db) {
  const { rows } = await run(db).query(
    QUESTIONS_SQL.replace('%WHERE%', 'q.sector_id = $1 and not q.is_nps'),
    [sectorId],
  );
  return rows;
}

export async function findActiveNpsQuestion(db) {
  const { rows } = await run(db).query(QUESTIONS_SQL.replace('%WHERE%', 'q.is_nps'));
  return rows[0] ?? null;
}

/** Pergunta que pode receber resposta nesta avaliação: do setor dela ou a de NPS, e ativa. */
export async function findAnswerableQuestion(questionId, sectorId, db) {
  const { rows } = await run(db).query(
    `select id, is_required, is_nps from public.questions
      where id = $1 and is_active and (is_nps or sector_id = $2)`,
    [questionId, sectorId],
  );
  return rows[0] ?? null;
}

export async function findActiveOption(questionId, value, db) {
  const { rows } = await run(db).query(
    'select 1 from public.question_options where question_id = $1 and value = $2 and is_active',
    [questionId, value],
  );
  return rows.length > 0;
}

export async function countMissingRequired(sectorId, evaluationId, db) {
  const { rows } = await run(db).query(
    `select count(*)::int as n
       from public.questions q
      where q.is_active and q.is_required and not q.is_nps and q.sector_id = $1
        and exists (select 1 from public.question_options o where o.question_id = q.id and o.is_active)
        and not exists (select 1 from public.answers a
                         where a.evaluation_id = $2 and a.question_id = q.id and not a.skipped)`,
    [sectorId, evaluationId],
  );
  return rows[0].n;
}
