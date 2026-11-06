import { getPool } from '../config/db.js';

export async function refresh(db = getPool()) {
  const { rows } = await db.query(`
    with observations as (
      select 'evaluation'::text as kind, e.visit_date, e.sector_id, s.name as sector_name,
             e.shift_id, sh.name as shift_name, e.team_id, t.name as team_name,
             null::uuid as question_id, null::text as question_text, false as is_nps,
             e.status, e.nps_score as value, count(*)::int as total
        from public.evaluations e
        join public.sectors s on s.id = e.sector_id
        left join public.shifts sh on sh.id = e.shift_id
        left join public.teams t on t.id = e.team_id
       group by e.visit_date, e.sector_id, s.name, e.shift_id, sh.name,
                e.team_id, t.name, e.status, e.nps_score
      union all
      select 'answer', e.visit_date, e.sector_id, s.name, e.shift_id, sh.name,
             e.team_id, t.name, a.question_id, q.text, q.is_nps, e.status, a.value, count(*)::int
        from public.answers a
        join public.evaluations e on e.id = a.evaluation_id
        join public.questions q on q.id = a.question_id
        join public.sectors s on s.id = e.sector_id
        left join public.shifts sh on sh.id = e.shift_id
        left join public.teams t on t.id = e.team_id
       where not a.skipped
       group by e.visit_date, e.sector_id, s.name, e.shift_id, sh.name,
                e.team_id, t.name, a.question_id, q.text, q.is_nps, e.status, a.value
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'kind', kind, 'month', to_char(visit_date, 'YYYY-MM'),
      'sectorId', sector_id, 'sector', sector_name, 'shiftId', shift_id,
      'shift', shift_name, 'teamId', team_id, 'team', team_name,
      'questionId', question_id, 'question', question_text, 'isNps', is_nps,
      'status', status, 'value', value, 'count', total
    )), '[]'::jsonb) as rows from observations
  `);
  const result = await db.query(
    `insert into public.dashboard_snapshots (id, refreshed_at, rows)
     values (1, now(), $1::jsonb)
     on conflict (id) do update set refreshed_at = excluded.refreshed_at, rows = excluded.rows
     returning refreshed_at, rows`,
    [JSON.stringify(rows[0].rows)],
  );
  return result.rows[0];
}

export async function latest(db = getPool()) {
  const { rows } = await db.query('select refreshed_at, rows from public.dashboard_snapshots where id = 1');
  return rows[0] ?? null;
}
