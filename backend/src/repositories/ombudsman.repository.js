import { getPool } from '../config/db.js';

const fields = `c.id, c.code, c.feedback_type as "feedbackType", c.message,
  c.contact_requested as "contactRequested", c.phone, c.status,
  c.closure_reason as "closureReason", c.closed_at as "closedAt", c.created_at as "createdAt",
  e.visit_date::text as "visitDate", e.visit_time::text as "visitTime",
  s.name as sector, sh.name as shift, u.full_name as "closedBy"`;
const joins = `from public.ombudsman_cases c
  join public.evaluations e on e.id = c.evaluation_id
  join public.sectors s on s.id = e.sector_id
  left join public.shifts sh on sh.id = e.shift_id
  left join public.users u on u.id = c.closed_by`;

export async function list(page) {
  const db = getPool();
  const { rows } = await db.query(`select ${fields.replace('c.phone,', "case when c.phone is not null then '(**) *****-' || right(c.phone, 4) end as phone,")}
    ${joins} order by c.created_at desc, c.id desc limit 50 offset $1`, [(page - 1) * 50]);
  return rows;
}
export async function find(id, tx = getPool(), lock = false) {
  return (await tx.query(`select ${fields} ${joins} where c.id = $1 ${lock ? 'for update of c' : ''}`, [id])).rows[0];
}
export async function history(id, tx) {
  const attempts = (await tx.query(`select a.id, a.attempt_number as "attemptNumber", a.attempted_at as at,
    a.outcome, a.wants_to_continue as "wantsToContinue", a.notes, u.full_name as author
    from public.ombudsman_contact_attempts a join public.users u on u.id = a.attempted_by
    where a.case_id = $1 order by a.attempt_number`, [id])).rows;
  const actions = (await tx.query(`select a.id, a.description, a.created_at as at, u.full_name as author
    from public.ombudsman_case_actions a join public.users u on u.id = a.created_by
    where a.case_id = $1 order by a.created_at, a.id`, [id])).rows;
  return { attempts, actions };
}
export async function insertAttempt(id, actor, input, tx) {
  await tx.query(`insert into public.ombudsman_contact_attempts
    (case_id, attempted_by, outcome, wants_to_continue, notes) values ($1,$2,$3,$4,$5)`,
  [id, actor.id, input.outcome, input.wantsToContinue ?? null, input.notes || null]);
}
export async function insertAction(id, actor, input, tx) {
  await tx.query(`insert into public.ombudsman_case_actions (case_id, created_by, description) values ($1,$2,$3)`,
    [id, actor.id, input.description]);
}
export async function close(id, actor, tx) {
  await tx.query(`update public.ombudsman_cases set status = 'closed', closure_reason = 'resolved',
    closed_at = clock_timestamp(), closed_by = $2 where id = $1`, [id, actor.id]);
}
