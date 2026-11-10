import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { before, after, describe, it } from 'node:test';
import { createSandboxPool } from './helpers/sandbox-pool.js';
import { attemptSchema, actionSchema } from '../src/validators/ombudsman.validator.js';

process.env.JWT_SECRET = 'segredo-ouvidoria-teste-com-mais-de-trinta-e-dois-caracteres';
const db = await import('../src/config/db.js');

it('valida resultado, interesse e observações sem criar campos obrigatórios adicionais', () => {
  assert.equal(attemptSchema.safeParse({ outcome: 'no_answer' }).success, true);
  assert.equal(attemptSchema.safeParse({ outcome: 'no_answer', wantsToContinue: false }).success, false);
  assert.equal(attemptSchema.safeParse({ outcome: 'answered' }).success, false);
  assert.equal(attemptSchema.safeParse({ outcome: 'answered', wantsToContinue: false }).success, true);
  assert.equal(attemptSchema.safeParse({ outcome: 'no_answer', notes: 'a'.repeat(2001) }).success, false);
  assert.equal(actionSchema.safeParse({ description: '   ' }).success, false);
});

describe('ouvidoria: API e banco, com rollback integral', { skip: !db.isDatabaseConfigured() && 'DATABASE_URL não configurada.' }, () => {
  let pool, client, sandbox, server, base, sector, shift, nps;
  const cookies = {};
  const actors = {};
  const one = async (sql, params) => (await sandbox.query(sql, params)).rows[0];
  async function call(method, path, body, role = 'ouvidoria', csrf = true) {
    const res = await fetch(`${base}/api/admin/ouvidoria${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(cookies[role] ? { cookie: cookies[role] } : {}), ...(csrf ? { 'X-CSRF-Protection': '1' } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json(), cache: res.headers.get('cache-control') };
  }
  async function makeCase(contact = true) {
    const ev = await one(`insert into public.evaluations (sector_id, visit_date, shift_id, access_token_hash)
      values ($1,'2026-01-01',$2,$3) returning id`, [sector.id, shift.id, randomBytes(32)]);
    await one(`insert into public.answers (evaluation_id,question_id,value) values ($1,$2,4) returning *`, [ev.id,nps.id]);
    const item = await one(`insert into public.ombudsman_cases (evaluation_id,message,contact_requested,phone,consent_given,consent_at)
      values ($1,'Feedback voluntário',$2,$3,$2,case when $2 then now() else null end) returning *`, [ev.id,contact,contact ? '51999998888' : null]);
    return item;
  }
  before(async () => {
    pool = db.getPool(); client = await pool.connect(); await client.query('begin');
    sandbox = createSandboxPool(client); db.setPoolForTesting(sandbox);
    // Exercita a nova migração sem aplicá-la permanentemente ao banco do usuário.
    const exists = await one(`select 1 from pg_trigger where tgname = 'ombudsman_close_after_three_attempts_trg'`);
    if (!exists) {
      const sql = await readFile(new URL('../migrations/1792180100000_ouvidoria-tres-tentativas.sql', import.meta.url), 'utf8');
      await sandbox.query(sql.split('-- Down Migration')[0]);
    }
    sector = await one(`insert into public.sectors (name,slug) values ('ZZ Ouvidoria','zz-ouvidoria-etapa7') returning *`);
    shift = await one(`insert into public.shifts (name,start_time,end_time) values ('ZZ Ouvidoria','01:00','02:00') returning *`);
    await sandbox.query(`update public.questions set is_active=false where is_nps and is_active`);
    nps = await one(`insert into public.questions (text,is_nps,is_required) values ('ZZ NPS',true,true) returning *`);
    await sandbox.query(`insert into public.question_options (question_id,value) values ($1,4)`, [nps.id]);
    const { hashPassword } = await import('../src/services/password.service.js');
    const { signSession } = await import('../src/services/token.service.js');
    const hash = await hashPassword('Senha@Teste1234');
    for (const role of ['super_admin','gestor','ouvidoria']) {
      const user = await one(`insert into public.users (username,full_name,role,sector_id,password_hash,must_change_password)
        values ($1,$1,$2,$3,$4,false) returning *`, [`zz_etapa7_${role}`,role,role === 'gestor' ? sector.id : null,hash]);
      actors[role] = user;
      cookies[role] = `hnps_session=${signSession({ id:user.id,tokenVersion:user.token_version },{ remember:false })}`;
    }
    const { createApp } = await import('../src/app.js');
    server = createApp().listen(0); await new Promise((resolve) => server.once('listening',resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (client) { await client.query('rollback'); client.release(); }
    db.setPoolForTesting(null);
    if (pool) await pool.end();
  });

  it('nega anônimo e gestor; Super Admin consulta mas não registra; exige CSRF', async () => {
    const item = await makeCase();
    assert.equal((await call('GET','',undefined,'public')).status,401);
    assert.equal((await call('GET',`/${item.id}`,undefined,'gestor')).status,403);
    assert.equal((await call('POST',`/${item.id}/attempts`,{ outcome:'no_answer' },'super_admin')).status,403);
    assert.equal((await call('POST',`/${item.id}/actions`,{ description:'Ação' },'gestor')).status,403);
    assert.equal((await call('POST',`/${item.id}/attempts`,{ outcome:'no_answer' },'ouvidoria',false)).status,403);
    const detail = await call('GET',`/${item.id}`,undefined,'super_admin');
    assert.equal(detail.status,200); assert.equal(detail.body.case.phone,'51999998888');
    assert.equal(detail.cache,'no-store');
    const list = await call('GET','');
    assert.equal(list.status,200);
    assert.equal(list.body.cases.find((row) => row.id === item.id).phone,'(**) *****-8888');
  });
  it('preserva interesse, autoria, tentativas e providências; conclui sem reabrir', async () => {
    const item = await makeCase();
    const contact = await call('POST',`/${item.id}/attempts`,{ outcome:'answered',wantsToContinue:false,notes:'Não deseja continuar.' });
    assert.equal(contact.status,201);
    assert.equal(contact.body.case.attempts[0].wantsToContinue,false);
    assert.equal(contact.body.case.attempts[0].author,actors.ouvidoria.full_name);
    assert.equal(contact.body.case.status,'open');
    assert.equal((await call('POST',`/${item.id}/actions`,{ description:'Providência registrada.' })).status,201);
    const closed = await call('POST',`/${item.id}/close`,{});
    assert.equal(closed.status,200); assert.equal(closed.body.case.closureReason,'resolved');
    assert.equal(closed.body.case.actions.length,1);
    assert.equal((await call('POST',`/${item.id}/close`,{})).status,409);
    assert.equal((await call('POST',`/${item.id}/actions`,{ description:'Outra' })).status,409);
    assert.equal((await call('POST',`/${item.id}/attempts`,{ outcome:'no_answer' })).status,409);
    assert.equal((await call('GET',`/${item.id}`)).status,200);
    await assert.rejects(one(`update public.ombudsman_cases set status='open',closure_reason=null,closed_at=null,closed_by=null where id=$1 returning *`,[item.id]));
  });
  it('encerra na terceira tentativa sem resposta TOTAL, inclusive com contato atendido entre elas', async () => {
    const item = await makeCase();
    const attempt = (body) => call('POST',`/${item.id}/attempts`,body);
    for (let number=1;number<=2;number++) {
      const res = await attempt({ outcome:'no_answer' });
      assert.equal(res.status,201); assert.equal(res.body.case.status,'open');
      assert.equal(res.body.case.attempts.at(-1).attemptNumber,number);
    }
    assert.equal((await attempt({ outcome:'answered',wantsToContinue:true })).body.case.status,'open');
    const third = await attempt({ outcome:'no_answer' });
    assert.equal(third.status,201); assert.equal(third.body.case.status,'closed');
    assert.equal(third.body.case.closureReason,'contact_failed');
    assert.equal(third.body.case.attempts.length,4);
    assert.ok(third.body.case.closedAt); assert.equal(third.body.case.closedBy,actors.ouvidoria.full_name);
    assert.equal((await attempt({ outcome:'no_answer' })).status,409);
    const history = await call('GET',`/${item.id}`);
    assert.equal(history.body.case.attempts.length,4);
    await assert.rejects(one(`update public.ombudsman_contact_attempts set notes='Alteração' where case_id=$1 returning *`,[item.id]));
    await assert.rejects(one(`delete from public.ombudsman_contact_attempts where case_id=$1 returning *`,[item.id]));
  });
  it('o banco encerra exatamente na terceira tentativa e recusa uma quarta inclusão direta', async () => {
    const item = await makeCase();
    for (let number = 1; number <= 3; number += 1) {
      await one(`insert into public.ombudsman_contact_attempts (case_id,attempted_by,outcome)
        values ($1,$2,'no_answer') returning *`, [item.id,actors.ouvidoria.id]);
      const row = await one('select status,closure_reason from public.ombudsman_cases where id=$1',[item.id]);
      assert.equal(row.status,number === 3 ? 'closed' : 'open');
      assert.equal(row.closure_reason,number === 3 ? 'contact_failed' : null);
    }
    await assert.rejects(one(`insert into public.ombudsman_contact_attempts (case_id,attempted_by,outcome)
      values ($1,$2,'no_answer') returning *`,[item.id,actors.ouvidoria.id]));
    assert.equal((await one('select count(*)::int as total from public.ombudsman_contact_attempts where case_id=$1',[item.id])).total,3);
  });
  it('anônimo permite providências e conclusão, sem contato; feedback único por avaliação', async () => {
    const item = await makeCase(false);
    assert.equal((await call('POST',`/${item.id}/attempts`,{ outcome:'no_answer' })).status,400);
    assert.equal((await call('POST',`/${item.id}/actions`,{ description:'Analisado o feedback anônimo.' })).status,201);
    const closed = await call('POST',`/${item.id}/close`,{});
    assert.equal(closed.body.case.closureReason,'resolved');
    await assert.rejects(one(`insert into public.ombudsman_cases (evaluation_id,message,contact_requested) values ($1,'Duplicado',false) returning *`,[item.evaluation_id]),{ code:'23505' });
    await assert.rejects(one(`update public.ombudsman_case_actions set description='Alterada' where case_id=$1 returning *`,[item.id]));
  });
  it('rejeita dados inválidos, reabertura e identificadores inexistentes', async () => {
    const item = await makeCase();
    assert.equal((await call('POST',`/${item.id}/attempts`,{ outcome:'answered' })).status,400);
    assert.equal((await call('POST',`/${item.id}/actions`,{ description:' ' })).status,400);
    assert.equal((await call('POST',`/${item.id}/close`,{ status:'open' })).status,400);
    assert.equal((await call('PATCH',`/${item.id}`,{ status:'open' })).status,404);
    assert.equal((await call('GET','/invalido')).status,404);
    assert.equal((await call('GET','/00000000-0000-4000-8000-000000000000')).status,404);
  });
});
