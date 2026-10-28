import { getPool } from '../config/db.js';

const run = (db) => db ?? getPool();

export async function get(db) {
  const { rows } = await run(db).query('select * from public.app_settings where id');
  return rows[0] ?? null;
}

export async function setPrivacyPolicyUrl(url, userId, db) {
  const { rows } = await run(db).query(
    `update public.app_settings set privacy_policy_url = $1, updated_by = $2 where id returning *`,
    [url, userId],
  );
  return rows[0];
}
