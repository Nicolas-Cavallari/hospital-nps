import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { closePool, getPool, isDatabaseConfigured } from '../src/config/db.js';

/**
 * Valida o modelo de dados contra o banco configurado em DATABASE_URL.
 *
 * Tudo roda dentro de UMA transação que é DESFEITA ao final (ROLLBACK): nenhum dado é gravado
 * no banco, então é seguro rodar também contra o Supabase. Exige as migrações já aplicadas.
 *
 * Executar: npm run test:db
 */

const APP_TABLES = [
  'sectors',
  'shifts',
  'teams',
  'users',
  'questions',
  'question_options',
  'evaluations',
  'answers',
  'ombudsman_cases',
  'ombudsman_contact_attempts',
  'ombudsman_case_actions',
];

// Hash FALSO, só com o formato de um hash argon2; usado dentro da transação desfeita.
const FAKE_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$ZmFrZXNhbHRmYWtlc2FsdA$ZmFrZWhhc2hmYWtlaGFzaGZha2VoYXNoZmFrZWhhc2g';

const skipReason = isDatabaseConfigured()
  ? false
  : 'DATABASE_URL não configurada (preencha backend/.env para validar o banco).';

describe('modelo de dados', { skip: skipReason }, () => {
  let client;
  let spCounter = 0;

  const query = (sql, params) => client.query(sql, params);
  const one = async (sql, params) => (await query(sql, params)).rows[0];

  /** Executa `fn` e desfaz tudo o que ela gravou (savepoint). */
  async function sandbox(fn) {
    const name = `sp_${spCounter++}`;
    await query(`savepoint ${name}`);
    try {
      return await fn();
    } finally {
      await query(`rollback to savepoint ${name}`);
      await query(`release savepoint ${name}`);
    }
  }

  /** Espera que o comando seja RECUSADO pelo banco, com mensagem que case com `pattern`. */
  async function refuses(sql, params, pattern) {
    const name = `sp_${spCounter++}`;
    await query(`savepoint ${name}`);
    let error = null;
    try {
      await query(sql, params);
    } catch (err) {
      error = err;
    }
    await query(`rollback to savepoint ${name}`);
    await query(`release savepoint ${name}`);
    assert.ok(error, `o banco deveria recusar: ${sql.slice(0, 80)}...`);
    assert.match(`${error.message} ${error.constraint ?? ''}`, pattern);
  }

  async function createFixtures() {
    const sector = await one(
      `insert into sectors (name, slug) values ('Setor Teste A', 'setor-teste-a') returning *`,
    );
    const other = await one(
      `insert into sectors (name, slug) values ('Setor Teste B', 'setor-teste-b') returning *`,
    );
    const shift = await one(
      `insert into shifts (name, start_time, end_time) values ('Turno Teste', '13:00', '19:00') returning *`,
    );
    const team = await one(
      `insert into teams (sector_id, shift_id, name) values ($1, $2, 'Equipe A') returning *`,
      [sector.id, shift.id],
    );
    const ouvidoria = await one(
      `insert into users (username, full_name, role, password_hash)
       values ('ouvidoria.teste', 'Ouvidoria Teste', 'ouvidoria', $1) returning *`,
      [FAKE_HASH],
    );

    const scale = await one(
      `insert into questions (sector_id, text) values ($1, 'Pergunta de escala?') returning *`,
      [sector.id],
    );
    for (let v = 1; v <= 5; v += 1) {
      await query(`insert into question_options (question_id, value) values ($1, $2)`, [scale.id, v]);
    }

    const otherQuestion = await one(
      `insert into questions (sector_id, text) values ($1, 'Pergunta de outro setor?') returning *`,
      [other.id],
    );
    await query(`insert into question_options (question_id, value) values ($1, 3)`, [otherQuestion.id]);

    const nps = await one(
      `insert into questions (is_nps, text, is_required) values (true, 'NPS?', true) returning *`,
    );
    for (let v = 0; v <= 10; v += 1) {
      await query(`insert into question_options (question_id, value) values ($1, $2)`, [nps.id, v]);
    }

    return { sector, other, shift, team, ouvidoria, scale, otherQuestion, nps };
  }

  const newEvaluation = (f, extra = {}) => {
    const token = createHash('sha256').update(randomBytes(32)).digest();
    return one(
      `insert into evaluations (sector_id, visit_date, shift_id, access_token_hash)
       values ($1, '2026-10-02', $2, $3) returning *`,
      [extra.sector_id ?? f.sector.id, extra.shift_id ?? f.shift.id, token],
    );
  };

  const upsertAnswer = (evaluationId, questionId, value) =>
    one(
      `insert into answers (evaluation_id, question_id, value, skipped)
       values ($1, $2, $3::smallint, ($3::smallint) is null)
       on conflict (evaluation_id, question_id)
       do update set value = excluded.value, skipped = excluded.skipped
       returning *`,
      [evaluationId, questionId, value],
    );

  const loadEvaluation = (id) => one(`select * from evaluations where id = $1`, [id]);

  before(async () => {
    client = await getPool().connect();
    const { rows } = await client.query(
      `select count(*)::int as n from pg_tables where schemaname = 'public' and tablename = any($1)`,
      [APP_TABLES],
    );
    assert.equal(
      rows[0].n,
      APP_TABLES.length,
      'Tabelas não encontradas: aplique as migrações antes (npm run db:migrate).',
    );
    await client.query('begin');
  });

  after(async () => {
    if (client) {
      await client.query('rollback'); // nada do que foi testado permanece no banco
      client.release();
    }
    await closePool();
  });

  it('todas as tabelas existem com RLS ativado', async () => {
    const { rows } = await query(
      `select c.relname, c.relrowsecurity
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = any($1)`,
      [[...APP_TABLES, 'pgmigrations']],
    );
    assert.equal(rows.length, APP_TABLES.length + 1);
    for (const row of rows) assert.equal(row.relrowsecurity, true, `RLS desativado em ${row.relname}`);
  });

  it('usuários: só guarda hash de senha e respeita perfil/setor', async () => {
    await sandbox(async () => {
      const f = await createFixtures();
      const insert = `insert into users (username, full_name, role, sector_id, password_hash)
                      values ($1, 'Nome', $2, $3, $4)`;

      await refuses(insert, ['ana.teste', 'ouvidoria', null, 'senha-em-texto-puro'], /users_password_is_hash/);
      await refuses(insert, ['gestor.teste', 'gestor', null, FAKE_HASH], /users_gestor_sector/);
      await refuses(insert, ['adm.teste', 'super_admin', f.sector.id, FAKE_HASH], /users_gestor_sector/);
      await refuses(insert, ['Maiuscula', 'ouvidoria', null, FAKE_HASH], /users_username_format/);
      await refuses(insert, ['ouvidoria.teste', 'ouvidoria', null, FAKE_HASH], /users_username_key/);

      const gestor = await one(`${insert} returning *`, ['gestor.teste', 'gestor', f.sector.id, FAKE_HASH]);
      assert.equal(gestor.must_change_password, true, 'senha temporária força a troca no primeiro login');
      assert.equal(gestor.is_active, true);
    });
  });

  it('setores, turnos e equipes: unicidade e vínculo equipe-setor', async () => {
    await sandbox(async () => {
      const f = await createFixtures();
      await refuses(`insert into sectors (name, slug) values ('SETOR TESTE A', 'outro-slug')`, [], /sectors_name_key/);
      await refuses(`insert into sectors (name, slug) values ('Novo', 'Slug Inválido')`, [], /sectors_slug_format/);
      await refuses(
        `insert into teams (sector_id, shift_id, name) values ($1, $2, 'Equipe A')`,
        [f.sector.id, f.shift.id],
        /teams_name_per_sector_shift_key/,
      );
      // Turno que atravessa a meia-noite é aceito (início maior que o fim).
      await one(`insert into shifts (name, start_time, end_time) values ('Noite Teste', '19:00', '07:00') returning id`);
      await refuses(`insert into shifts (name, start_time, end_time) values ('Zero', '08:00', '08:00')`, [], /shifts_interval_valid/);
    });
  });

  it('perguntas: NPS global único, escopo por setor e alternativas', async () => {
    await sandbox(async () => {
      const f = await createFixtures();
      await refuses(`insert into questions (is_nps, text, is_required, sector_id) values (true, 'x', true, $1)`, [f.sector.id], /questions_scope/);
      await refuses(`insert into questions (text) values ('sem setor')`, [], /questions_scope/);
      await refuses(`insert into questions (is_nps, text, is_required) values (true, 'segundo NPS', true)`, [], /questions_one_active_nps/);
      await refuses(`insert into questions (is_nps, text, is_required) values (true, 'x', false)`, [], /questions_nps_required|questions_one_active_nps/);
      await refuses(`insert into question_options (question_id, value) values ($1, 11)`, [f.scale.id], /question_options_value_range/);

      // Desativado o NPS atual, outro pode assumir.
      await query(`update questions set is_active = false where id = $1`, [f.nps.id]);
      await one(`insert into questions (is_nps, text, is_required) values (true, 'Novo NPS', true) returning id`);
    });
  });

  it('avaliações: horário ou turno, equipe do mesmo setor e token em SHA-256', async () => {
    await sandbox(async () => {
      const f = await createFixtures();
      const token = createHash('sha256').update('t').digest();

      await refuses(
        `insert into evaluations (sector_id, visit_date, access_token_hash) values ($1, '2026-10-02', $2)`,
        [f.sector.id, token],
        /evaluations_when_visited/,
      );
      await refuses(
        `insert into evaluations (sector_id, visit_date, visit_time, access_token_hash) values ($1, '2026-10-02', '14:30', $2)`,
        [f.sector.id, Buffer.from('curto')],
        /evaluations_token_sha256/,
      );
      // Equipe do setor A não pode ser atribuída a uma avaliação do setor B.
      await refuses(
        `insert into evaluations (sector_id, visit_date, visit_time, team_id, access_token_hash)
         values ($1, '2026-10-02', '14:30', $2, $3)`,
        [f.other.id, f.team.id, token],
        /evaluations_team_in_sector/,
      );

      const ok = await one(
        `insert into evaluations (sector_id, visit_date, visit_time, team_id, access_token_hash)
         values ($1, '2026-10-02', '14:30', $2, $3) returning *`,
        [f.sector.id, f.team.id, token],
      );
      assert.equal(ok.status, 'incomplete');
      assert.equal(ok.nps_score, null);
      await refuses(
        `insert into evaluations (sector_id, visit_date, visit_time, access_token_hash) values ($1, '2026-10-02', '10:00', $2)`,
        [f.sector.id, token],
        /evaluations_token_key/,
      );
    });
  });

  it('respostas: gravadas individualmente e corrigidas por substituição (sem apagar)', async () => {
    await sandbox(async () => {
      const f = await createFixtures();
      const ev = await newEvaluation(f);

      const first = await upsertAnswer(ev.id, f.scale.id, 2);
      assert.equal(first.value, 2);

      const corrected = await upsertAnswer(ev.id, f.scale.id, 4); // voltou e trocou o número
      assert.equal(corrected.value, 4);
      const { rows } = await query(`select * from answers where evaluation_id = $1`, [ev.id]);
      assert.equal(rows.length, 1, 'continua existindo uma única linha por pergunta');

      // Voltar e pular: a linha é mantida e marcada como pulada.
      const skipped = await upsertAnswer(ev.id, f.scale.id, null);
      assert.equal(skipped.skipped, true);
      assert.equal(skipped.value, null);

      await refuses(`delete from answers where evaluation_id = $1`, [ev.id], /somente|Exclusão não permitida/);
    });
  });

  it('respostas: só alternativas válidas, perguntas do setor e perguntas ativas', async () => {
    await sandbox(async () => {
      const f = await createFixtures();
      const ev = await newEvaluation(f);
      const insert = `insert into answers (evaluation_id, question_id, value, skipped) values ($1, $2, $3, $4)`;

      await refuses(insert, [ev.id, f.scale.id, 7, false], /answers_valid_option/);
      await refuses(insert, [ev.id, f.scale.id, null, false], /answers_value_or_skipped/);
      await refuses(insert, [ev.id, f.scale.id, 3, true], /answers_value_or_skipped/);
      await refuses(insert, [ev.id, f.otherQuestion.id, 3, false], /não pertence ao setor/);

      await query(`update questions set is_active = false where id = $1`, [f.scale.id]);
      await refuses(insert, [ev.id, f.scale.id, 3, false], /desativada/);
    });
  });

  it('respostas: obrigatória e NPS não podem ser puladas', async () => {
    await sandbox(async () => {
      const f = await createFixtures();
      const ev = await newEvaluation(f);

      await upsertAnswer(ev.id, f.scale.id, null); // opcional: pode pular
      await query(`update questions set is_required = true where id = $1`, [f.scale.id]);
      await refuses(
        `insert into answers (evaluation_id, question_id, skipped) values ($1, $2, true)
         on conflict (evaluation_id, question_id) do update set skipped = true, value = null`,
        [ev.id, f.scale.id],
        /obrigatória/,
      );
      await refuses(
        `insert into answers (evaluation_id, question_id, skipped) values ($1, $2, true)`,
        [ev.id, f.nps.id],
        /obrigatória/,
      );
    });
  });

  it('NPS: a nota da avaliação acompanha a resposta, e finalizar exige a nota', async () => {
    await sandbox(async () => {
      const f = await createFixtures();
      const ev = await newEvaluation(f);

      await refuses(
        `update evaluations set status = 'completed', completed_at = now() where id = $1`,
        [ev.id],
        /evaluations_completed_has_nps/,
      );

      await upsertAnswer(ev.id, f.nps.id, 3);
      assert.equal((await loadEvaluation(ev.id)).nps_score, 3);
      await upsertAnswer(ev.id, f.nps.id, 9); // corrigiu a nota
      assert.equal((await loadEvaluation(ev.id)).nps_score, 9);

      await query(`update evaluations set status = 'completed', completed_at = now() where id = $1`, [ev.id]);
      assert.equal((await loadEvaluation(ev.id)).status, 'completed');
    });
  });

  it('avaliação finalizada é imutável e nenhuma avaliação pode ser excluída', async () => {
    await sandbox(async () => {
      const f = await createFixtures();
      const ev = await newEvaluation(f);
      await upsertAnswer(ev.id, f.scale.id, 5);
      await upsertAnswer(ev.id, f.nps.id, 10);
      await query(`update evaluations set status = 'completed', completed_at = now() where id = $1`, [ev.id]);

      await refuses(`update answers set value = 1 where evaluation_id = $1 and question_id = $2`, [ev.id, f.scale.id], /finalizada/);
      await refuses(
        `insert into answers (evaluation_id, question_id, value, skipped) values ($1, $2, 1, false)`,
        [ev.id, f.nps.id],
        /finalizada|duplicate key/,
      );
      await refuses(`update evaluations set status = 'incomplete', completed_at = null where id = $1`, [ev.id], /finalizada/);
      await refuses(`update evaluations set visit_date = '2026-01-01' where id = $1`, [ev.id], /finalizada/);
      await refuses(`delete from evaluations where id = $1`, [ev.id], /Exclusão não permitida/);
    });
  });

  it('perguntas com respostas são preservadas: não excluem, desativam sem perder o histórico', async () => {
    await sandbox(async () => {
      const f = await createFixtures();
      const ev = await newEvaluation(f);
      await upsertAnswer(ev.id, f.scale.id, 4);

      await refuses(`delete from questions where id = $1`, [f.scale.id], /foreign key|answers/);
      await refuses(`delete from question_options where question_id = $1 and value = 4`, [f.scale.id], /foreign key|answers/);
      await refuses(`update questions set sector_id = $2 where id = $1`, [f.scale.id, f.other.id], /respostas não pode mudar/);

      await query(`update questions set is_active = false where id = $1`, [f.scale.id]);
      const history = await one(
        `select a.value, q.text, q.is_active
           from answers a join questions q on q.id = a.question_id
          where a.evaluation_id = $1`,
        [ev.id],
      );
      assert.equal(history.value, 4);
      assert.equal(history.is_active, false);

      // Pergunta sem nenhuma resposta ainda pode ser excluída (rascunho).
      await query(`delete from questions where id = $1`, [f.otherQuestion.id]);
    });
  });

  /** Cria uma avaliação com NPS baixo e o feedback correspondente. */
  async function newCase(f, nps, overrides = {}) {
    const ev = await newEvaluation(f);
    await upsertAnswer(ev.id, f.nps.id, nps);
    const data = {
      feedback_type: 'reclamacao',
      message: 'Esperei muito tempo.',
      contact_requested: true,
      phone: '51912345678',
      consent_given: true,
      consent_at: new Date(),
      ...overrides,
    };
    const created = await one(
      `insert into ombudsman_cases
         (evaluation_id, feedback_type, message, contact_requested, phone, consent_given, consent_at)
       values ($1, $2, $3, $4, $5, $6, $7) returning *`,
      [ev.id, data.feedback_type, data.message, data.contact_requested, data.phone, data.consent_given, data.consent_at],
    );
    return created;
  }

  it('ouvidoria: feedback só para NPS 0–6, com código e regras de contato/consentimento', async () => {
    await sandbox(async () => {
      const f = await createFixtures();

      const created = await newCase(f, 3);
      assert.match(created.code, /^OUV-\d{4}-\d{6}$/);
      assert.equal(created.status, 'open');
      const second = await newCase(f, 6, { contact_requested: false, phone: null, consent_given: false, consent_at: null });
      assert.notEqual(second.code, created.code, 'cada atendimento tem seu próprio código');

      const promoter = await newEvaluation(f);
      await upsertAnswer(promoter.id, f.nps.id, 9);
      const insert = `insert into ombudsman_cases
        (evaluation_id, message, contact_requested, phone, consent_given, consent_at)
        values ($1, 'msg', $2, $3, $4, $5)`;
      await refuses(insert, [promoter.id, false, null, false, null], /só existe para avaliações com nota/);

      const low = await newEvaluation(f);
      await upsertAnswer(low.id, f.nps.id, 2);
      await refuses(insert, [low.id, true, '51912345678', false, null], /contact_consistency/); // sem consentimento
      await refuses(insert, [low.id, true, null, true, new Date()], /contact_consistency/); // sem celular
      await refuses(insert, [low.id, false, '51912345678', false, null], /contact_consistency/); // anônimo com celular
      await refuses(insert, [low.id, true, '123', true, new Date()], /phone_format/);
      await refuses(
        `insert into ombudsman_cases (evaluation_id, message, contact_requested) values ($1, '   ', false)`,
        [low.id],
        /message_len/,
      );
      await refuses(
        `insert into ombudsman_cases (evaluation_id, message, contact_requested) values ($1, 'a', false)`,
        [created.evaluation_id],
        /ombudsman_cases_evaluation_key/,
      );
    });
  });

  it('ouvidoria: tentativas numeradas pelo banco e sem tentativas em atendimento anônimo', async () => {
    await sandbox(async () => {
      const f = await createFixtures();
      const c = await newCase(f, 2);
      const anonymous = await newCase(f, 4, { contact_requested: false, phone: null, consent_given: false, consent_at: null });

      const attempt = `insert into ombudsman_contact_attempts (case_id, attempted_by, outcome) values ($1, $2, 'no_answer') returning attempt_number`;
      assert.equal((await one(attempt, [c.id, f.ouvidoria.id])).attempt_number, 1);
      assert.equal((await one(attempt, [c.id, f.ouvidoria.id])).attempt_number, 2);
      assert.equal((await one(attempt, [c.id, f.ouvidoria.id])).attempt_number, 3);

      await refuses(attempt, [anonymous.id, f.ouvidoria.id], /anônimo/);
      await refuses(
        `insert into ombudsman_contact_attempts (case_id, attempted_by, outcome) values ($1, $2, 'answered')`,
        [c.id, f.ouvidoria.id],
        /interest_consistency/,
      );
      const answered = await one(
        `insert into ombudsman_contact_attempts (case_id, attempted_by, outcome, wants_to_continue, notes)
         values ($1, $2, 'answered', true, 'Pessoa quer seguir.') returning attempt_number`,
        [c.id, f.ouvidoria.id],
      );
      assert.equal(answered.attempt_number, 4);
    });
  });

  it('ouvidoria: histórico somente de inclusão e atendimento encerrado não reabre', async () => {
    await sandbox(async () => {
      const f = await createFixtures();
      const c = await newCase(f, 1);

      const attempt = await one(
        `insert into ombudsman_contact_attempts (case_id, attempted_by, outcome) values ($1, $2, 'no_answer') returning id`,
        [c.id, f.ouvidoria.id],
      );
      const action = await one(
        `insert into ombudsman_case_actions (case_id, description, created_by) values ($1, 'Setor acionado.', $2) returning id`,
        [c.id, f.ouvidoria.id],
      );

      await refuses(`update ombudsman_contact_attempts set outcome = 'answered' where id = $1`, [attempt.id], /somente de inclusão/);
      await refuses(`delete from ombudsman_contact_attempts where id = $1`, [attempt.id], /somente de inclusão/);
      await refuses(`update ombudsman_case_actions set description = 'x' where id = $1`, [action.id], /somente de inclusão/);
      await refuses(`delete from ombudsman_case_actions where id = $1`, [action.id], /somente de inclusão/);

      // O conteúdo original do feedback não muda; o encerramento exige motivo.
      await refuses(`update ombudsman_cases set message = 'editada' where id = $1`, [c.id], /não podem ser alterados/);
      await refuses(`update ombudsman_cases set status = 'closed' where id = $1`, [c.id], /closure_consistency/);

      await query(
        `update ombudsman_cases set status = 'closed', closure_reason = 'contact_failed', closed_at = now() where id = $1`,
        [c.id],
      );

      await refuses(`update ombudsman_cases set status = 'open', closure_reason = null, closed_at = null where id = $1`, [c.id], /não pode ser alterado nem reaberto/);
      await refuses(
        `insert into ombudsman_contact_attempts (case_id, attempted_by, outcome) values ($1, $2, 'no_answer')`,
        [c.id, f.ouvidoria.id],
        /encerrado/,
      );
      await refuses(
        `insert into ombudsman_case_actions (case_id, description, created_by) values ($1, 'x', $2)`,
        [c.id, f.ouvidoria.id],
        /encerrado/,
      );
      await refuses(`delete from ombudsman_cases where id = $1`, [c.id], /Exclusão não permitida/);

      // Os registros encerrados continuam consultáveis.
      const kept = await one(
        `select (select count(*)::int from ombudsman_contact_attempts where case_id = $1) as attempts,
                (select count(*)::int from ombudsman_case_actions where case_id = $1) as actions`,
        [c.id],
      );
      assert.deepEqual(kept, { attempts: 1, actions: 1 });
    });
  });

  it('atendimento anônimo não pode ser encerrado como "contato sem sucesso"', async () => {
    await sandbox(async () => {
      const f = await createFixtures();
      const anonymous = await newCase(f, 4, { contact_requested: false, phone: null, consent_given: false, consent_at: null });
      await refuses(
        `update ombudsman_cases set status = 'closed', closure_reason = 'contact_failed', closed_at = now() where id = $1`,
        [anonymous.id],
        /failed_needs_contact/,
      );
      await query(
        `update ombudsman_cases set status = 'closed', closure_reason = 'resolved', closed_at = now() where id = $1`,
        [anonymous.id],
      );
    });
  });
});
