import { getPool } from '../config/db.js';

const run = (db) => db ?? getPool();

export async function listAll(db) {
  const { rows } = await run(db).query('select * from public.sectors order by name');
  return rows;
}

export async function findById(id, db) {
  const { rows } = await run(db).query('select * from public.sectors where id = $1', [id]);
  return rows[0] ?? null;
}

export async function findBySlug(slug, db) {
  const { rows } = await run(db).query('select * from public.sectors where slug = $1', [slug]);
  return rows[0] ?? null;
}
