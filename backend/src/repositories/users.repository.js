import { getPool } from '../config/db.js';

const run = (db) => db ?? getPool();

export async function findByUsername(username, db) {
  const { rows } = await run(db).query('select * from public.users where username = $1', [username]);
  return rows[0] ?? null;
}

export async function findById(id, db) {
  const { rows } = await run(db).query('select * from public.users where id = $1', [id]);
  return rows[0] ?? null;
}

export async function findByIdForUpdate(id, db) {
  const { rows } = await run(db).query('select * from public.users where id = $1 for update', [id]);
  return rows[0] ?? null;
}

export async function list(db) {
  const { rows } = await run(db).query('select * from public.users order by created_at, username');
  return rows;
}

export async function insert({ username, fullName, role, sectorId, passwordHash }, db) {
  const { rows } = await run(db).query(
    `insert into public.users (username, full_name, role, sector_id, password_hash, must_change_password)
     values ($1, $2, $3, $4, $5, true) returning *`,
    [username, fullName, role, sectorId ?? null, passwordHash],
  );
  return rows[0];
}

/** Atualiza só os campos informados. Desativar a conta derruba as sessões abertas. */
export async function update(id, { fullName, sectorId, isActive }, db) {
  const sets = [];
  const params = [id];
  const add = (column, value) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };
  if (fullName !== undefined) add('full_name', fullName);
  if (sectorId !== undefined) add('sector_id', sectorId);
  if (isActive !== undefined) add('is_active', isActive);
  if (isActive === false) sets.push('token_version = token_version + 1');

  const { rows } = await run(db).query(
    `update public.users set ${sets.join(', ')} where id = $1 returning *`,
    params,
  );
  return rows[0] ?? null;
}

/** Grava o novo hash e derruba as sessões anteriores (incrementa token_version). */
export async function setPassword(id, { passwordHash, mustChangePassword }, db) {
  const { rows } = await run(db).query(
    `update public.users
        set password_hash = $2, must_change_password = $3, token_version = token_version + 1
      where id = $1 returning *`,
    [id, passwordHash, mustChangePassword],
  );
  return rows[0] ?? null;
}

/** Bloqueia os Super Admins ativos (evita duas desativações simultâneas deixarem zero). */
export async function lockActiveSuperAdmins(db) {
  await run(db).query(`select id from public.users where role = 'super_admin' and is_active for update`);
}

export async function countActiveSuperAdminsExcept(id, db) {
  const { rows } = await run(db).query(
    `select count(*)::int as n from public.users where role = 'super_admin' and is_active and id <> $1`,
    [id],
  );
  return rows[0].n;
}
