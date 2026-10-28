import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createSandboxPool } from './helpers/sandbox-pool.js';

/**
 * Fluxo completo da pesquisa pública, com a API rodando de verdade contra o banco configurado.
 *
 * Tudo acontece dentro de UMA transação que é DESFEITA ao final: nenhum dado de teste fica no
 * banco, então é seguro rodar também contra o banco real. (Dentro da transação, turnos e a
 * pergunta de NPS reais são desativados para os testes terem um cenário limpo; isso também é
 * desfeito.) Exige as migrações aplicadas. Executar: npm run test:survey
 */

const SECRET = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres-5555555555';
process.env.JWT_SECRET = SECRET;

const db = await import('../src/config/db.js');
const skipReason = db.isDatabaseConfigured()
  ? false
  : 'DATABASE_URL não configurada (preencha backend/.env para rodar estes testes).';

const PAST_DATE = '2026-01-15';
const PASSWORD = 'Senha@Teste1234';
const SLUG = 'zz-test-rec';

describe('pesquisa pública (API)', { skip: skipReason }, () => {
  let realPool;
  let client;
  let server;
  let base;
  let f; // fixtures

  const rows = async (sql, params) => (await client.query(sql, params)).rows;
  const one = async (sql, params) => (await rows(sql, params))[0];

  async function call(method, path, { body, token, cookie, csrf = false } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      redirect: 'manual',
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { 'x-evaluation-token': token } : {}),
        ...(cookie ? { cookie } : {}),
        ...(csrf ? { 'x-csrf-protection': '1' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // sem corpo
    }
    return { status: response.status, body: json, text, headers: response.headers, setCookie: response.headers.getSetCookie() };
  }

  /** Inicia uma avaliação e devolve { id, token }. */
  async function start(visit = {}) {
    const response = await call('POST', `/api/public/surveys/${SLUG}/evaluations`, {
      body: { visitDate: PAST_DATE, shiftId: f.tarde.id, ...visit },
    });
    assert.equal(response.status, 201, response.text);
    return { id: response.body.evaluation.id, token: response.body.accessToken, response };
  }

  const put = (ev, questionId, body) => call('PUT', `/api/public/evaluations/${ev.id}/answers/${questionId}`, { token: ev.token, body });
  const finish = (ev, body = {}) => call('POST', `/api/public/evaluations/${ev.id}/finish`, { token: ev.token, body });
  const evaluationRow = (id) => one('select * from public.evaluations where id = $1', [id]);
  const answersOf = (id) => rows('select * from public.answers where evaluation_id = $1 order by question_id', [id]);
  const caseOf = (id) => one('select * from public.ombudsman_cases where evaluation_id = $1', [id]);

  async function answerRequired(ev, value = 4) {
    assert.equal((await put(ev, f.qReq.id, { value })).status, 200);
  }

  async function makeOptions(questionId, { labels = {}, from = 1, to = 5 } = {}) {
    for (let value = from; value <= to; value += 1) {
      await client.query(`insert into public.question_options (question_id, value, label) values ($1, $2, $3)`, [questionId, value, labels[value] ?? null]);
    }
  }

  before(async () => {
    realPool = db.getPool();
    client = await realPool.connect();
    await client.query('begin');
    db.setPoolForTesting(createSandboxPool(client));

    // Cenário limpo (desfeito ao final): sem turnos nem NPS reais ativos.
    await client.query(`update public.shifts set is_active = false where is_active`);
    await client.query(`update public.questions set is_active = false where is_nps and is_active`);

    f = {};
    f.sector = await one(`insert into public.sectors (name, slug) values ('Recepção de teste', $1) returning *`, [SLUG]);
    f.off = await one(`insert into public.sectors (name, slug, is_active) values ('Setor desativado', 'zz-test-off', false) returning *`);
    f.other = await one(`insert into public.sectors (name, slug) values ('Outro setor', 'zz-test-outro') returning *`);

    f.manha = await one(`insert into public.shifts (name, start_time, end_time) values ('ZZ Manhã', '07:00', '13:00') returning *`);
    f.tarde = await one(`insert into public.shifts (name, start_time, end_time) values ('ZZ Tarde', '13:00', '19:00') returning *`);
    f.noite = await one(`insert into public.shifts (name, start_time, end_time) values ('ZZ Noite', '19:00', '07:00') returning *`);
    f.inactiveShift = await one(`insert into public.shifts (name, start_time, end_time, is_active) values ('ZZ Inativo', '01:00', '02:00', false) returning *`);
    f.teamTarde = await one(`insert into public.teams (sector_id, shift_id, name) values ($1, $2, 'Equipe Única') returning *`, [f.sector.id, f.tarde.id]);
    f.teamNoiteA = await one(`insert into public.teams (sector_id, shift_id, name) values ($1, $2, 'Equipe A') returning *`, [f.sector.id, f.noite.id]);
    f.teamNoiteB = await one(`insert into public.teams (sector_id, shift_id, name) values ($1, $2, 'Equipe B') returning *`, [f.sector.id, f.noite.id]);

    const question = (sectorId, text, extra = {}) =>
      one(
        `insert into public.questions (sector_id, text, is_required, is_active, position, description)
         values ($1, $2, $3, $4, $5, $6) returning *`,
        [sectorId, text, extra.required ?? false, extra.active ?? true, extra.position ?? 0, extra.description ?? null],
      );

    f.qReq = await question(f.sector.id, 'Pergunta obrigatória?', { required: true, position: 1 });
    await makeOptions(f.qReq.id, { labels: { 1: 'Muito ruim', 5: 'Excelente' } });
    f.qOpt = await question(f.sector.id, 'Pergunta opcional?', { position: 2 });
    await makeOptions(f.qOpt.id);
    f.qInactive = await question(f.sector.id, 'Pergunta desativada?', { active: false, position: 3 });
    await makeOptions(f.qInactive.id);
    f.qNoOptions = await question(f.sector.id, 'Pergunta sem alternativas?', { position: 4 });
    f.qOther = await question(f.other.id, 'Pergunta de outro setor?', { position: 1 });
    await makeOptions(f.qOther.id);

    f.nps = await one(
      `insert into public.questions (is_nps, text, description, is_required) values (true, 'NPS de teste?', '0 é nada provável', true) returning *`,
    );
    await makeOptions(f.nps.id, { from: 0, to: 10 });

    const { hashPassword } = await import('../src/services/password.service.js');
    const usersRepo = await import('../src/repositories/users.repository.js');
    const hash = await hashPassword(PASSWORD);
    const mk = async (username, role, sectorId) => {
      const row = await usersRepo.insert({ username, fullName: username, role, sectorId, passwordHash: hash });
      await usersRepo.setPassword(row.id, { passwordHash: hash, mustChangePassword: false });
    };
    await mk('zz_test_admin', 'super_admin');
    await mk('zz_test_gestor', 'gestor', f.sector.id);

    const { createApp } = await import('../src/app.js');
    server = createApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (client) {
      await client.query('rollback'); // nada permanece no banco
      client.release();
    }
    db.setPoolForTesting(null);
    if (realPool) await realPool.end();
  });

  // --------------------------------------------------------- definição
  describe('o respondente acessa a URL do setor e vê o que foi configurado', () => {
    it('mostra só as perguntas e alternativas ativas do setor, a pergunta de NPS e os turnos', async () => {
      const response = await call('GET', `/api/public/surveys/${SLUG}`);
      assert.equal(response.status, 200);
      const survey = response.body;

      assert.deepEqual(survey.sector, { name: 'Recepção de teste', slug: SLUG });
      assert.deepEqual(survey.questions.map((q) => q.text), ['Pergunta obrigatória?', 'Pergunta opcional?'],
        'sem pergunta desativada, sem pergunta de outro setor e sem pergunta sem alternativas');
      assert.equal(survey.questions[0].required, true);
      assert.equal(survey.questions[1].required, false);
      assert.deepEqual(survey.questions[0].options.map((o) => o.value), [1, 2, 3, 4, 5]);
      assert.equal(survey.questions[0].options[0].label, 'Muito ruim');
      assert.equal(survey.questions[0].options[4].label, 'Excelente');

      assert.equal(survey.nps.text, 'NPS de teste?');
      assert.deepEqual(survey.nps.options.map((o) => o.value), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      assert.deepEqual(survey.shifts.map((s) => s.name), ['ZZ Manhã', 'ZZ Tarde', 'ZZ Noite'],
        'só turnos ativos, em ordem de horário');
      assert.equal(survey.privacyPolicyUrl, null);
    });

    it('não expõe dados internos nem de outras pessoas', async () => {
      const { text } = await call('GET', `/api/public/surveys/${SLUG}`);
      assert.doesNotMatch(text, /sector_id|is_nps|team|password|hash|token|evaluation|answers|phone|cases/i);
    });

    it('setor inexistente, desativado ou mal escrito recebem a mesma resposta (404)', async () => {
      const unknown = await call('GET', '/api/public/surveys/zz-nao-existe');
      const off = await call('GET', '/api/public/surveys/zz-test-off');
      const odd = await call('GET', `/api/public/surveys/${encodeURIComponent("x' or '1'='1")}`);
      for (const response of [unknown, off, odd]) {
        assert.equal(response.status, 404);
        assert.equal(response.body.code, 'SURVEY_UNAVAILABLE');
      }
      assert.equal(unknown.text, off.text);
      assert.equal(unknown.text, odd.text);
      assert.equal((await call('POST', '/api/public/surveys/zz-test-off/evaluations', { body: { visitDate: PAST_DATE, shiftId: f.tarde.id } })).status, 404);
    });

    it('sem pergunta de NPS ativa a pesquisa fica indisponível (nunca incompleta)', async () => {
      await client.query(`update public.questions set is_active = false where id = $1`, [f.nps.id]);
      try {
        assert.equal((await call('GET', `/api/public/surveys/${SLUG}`)).status, 404);
      } finally {
        await client.query(`update public.questions set is_active = true where id = $1`, [f.nps.id]);
      }
    });
  });

  // ------------------------------------------------- conclusão normal
  describe('conclusão normal', () => {
    it('responde tudo, dá nota 9 e conclui sem feedback', async () => {
      const ev = await start();
      assert.equal(ev.response.headers.get('cache-control'), 'no-store');
      await answerRequired(ev, 5);
      assert.equal((await put(ev, f.qOpt.id, { value: 3 })).status, 200);
      assert.equal((await put(ev, f.nps.id, { value: 9 })).status, 200);

      const result = await finish(ev);
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, { completed: true, feedbackSent: false });

      const row = await evaluationRow(ev.id);
      assert.equal(row.status, 'completed');
      assert.equal(row.nps_score, 9);
      assert.ok(row.completed_at);
      assert.deepEqual((await answersOf(ev.id)).map((a) => [a.skipped, a.value]).sort(), [[false, 3], [false, 5], [false, 9]]);
      assert.equal(await caseOf(ev.id), undefined, 'sem feedback não há atendimento da ouvidoria');
    });

    it('depois de concluída, nada mais muda (409) e concluir de novo é recusado', async () => {
      const ev = await start();
      await answerRequired(ev);
      await put(ev, f.nps.id, { value: 10 });
      assert.equal((await finish(ev)).status, 200);

      assert.equal((await finish(ev)).status, 409);
      assert.equal((await put(ev, f.qReq.id, { value: 1 })).status, 409);
      assert.equal((await call('PUT', `/api/public/evaluations/${ev.id}/visit`, { token: ev.token, body: { visitDate: PAST_DATE, shiftId: f.manha.id } })).status, 409);
      assert.equal((await answersOf(ev.id)).find((a) => a.question_id === f.qReq.id).value, 4);
    });
  });

  // ------------------------------------------- obrigatória e opcional
  describe('perguntas obrigatórias e opcionais', () => {
    it('pergunta obrigatória não pode ser pulada nem ficar sem resposta', async () => {
      const ev = await start();
      const skip = await put(ev, f.qReq.id, { skipped: true });
      assert.equal(skip.status, 400);
      assert.equal(skip.body.code, 'REQUIRED_QUESTION');
      assert.equal((await answersOf(ev.id)).length, 0, 'nada foi gravado');

      // Nota dada, mas a obrigatória nunca respondida: não conclui.
      await put(ev, f.nps.id, { value: 9 });
      const early = await finish(ev);
      assert.equal(early.status, 400);
      assert.equal(early.body.code, 'REQUIRED_MISSING');
      assert.equal((await evaluationRow(ev.id)).status, 'incomplete');

      // Mesmo "pulada" gravada por outro caminho não conta como respondida: só resposta válida conta.
      await answerRequired(ev);
      assert.equal((await finish(ev)).status, 200);
    });

    it('sem a nota de NPS (0 a 10) a avaliação não conclui', async () => {
      const ev = await start();
      await answerRequired(ev);
      const result = await finish(ev);
      assert.equal(result.status, 400);
      assert.equal(result.body.code, 'NPS_REQUIRED');
      assert.equal((await evaluationRow(ev.id)).status, 'incomplete');
    });

    it('a pergunta de NPS também não pode ser pulada', async () => {
      const ev = await start();
      const skip = await put(ev, f.nps.id, { skipped: true });
      assert.equal(skip.status, 400);
      assert.equal(skip.body.code, 'REQUIRED_QUESTION');
    });

    it('pergunta opcional pode ser ignorada e a avaliação conclui', async () => {
      const ev = await start();
      await answerRequired(ev);
      const skipped = await put(ev, f.qOpt.id, { skipped: true });
      assert.equal(skipped.status, 200);
      assert.deepEqual(skipped.body.answer, { questionId: f.qOpt.id, value: null, skipped: true });
      await put(ev, f.nps.id, { value: 8 });

      assert.equal((await finish(ev)).status, 200);
      const stored = (await answersOf(ev.id)).find((a) => a.question_id === f.qOpt.id);
      assert.equal(stored.skipped, true);
      assert.equal(stored.value, null);
    });

    it('opcional não respondida e nem apresentada (sem linha) também não impede concluir', async () => {
      const ev = await start();
      await answerRequired(ev);
      await put(ev, f.nps.id, { value: 10 });
      assert.equal((await finish(ev)).status, 200);
      assert.equal((await answersOf(ev.id)).length, 2);
    });
  });

  // ------------------------------------------------- salvar e corrigir
  describe('respostas salvas uma a uma e corrigidas por substituição', () => {
    it('corrigir uma resposta substitui a anterior (uma linha por pergunta)', async () => {
      const ev = await start();
      await put(ev, f.qOpt.id, { value: 2 });
      await put(ev, f.qOpt.id, { value: 5 });
      let stored = (await answersOf(ev.id)).filter((a) => a.question_id === f.qOpt.id);
      assert.equal(stored.length, 1);
      assert.equal(stored[0].value, 5);

      await put(ev, f.qOpt.id, { skipped: true }); // voltou e preferiu pular
      stored = (await answersOf(ev.id)).filter((a) => a.question_id === f.qOpt.id);
      assert.equal(stored.length, 1);
      assert.deepEqual([stored[0].skipped, stored[0].value], [true, null]);

      await put(ev, f.nps.id, { value: 2 });
      await put(ev, f.nps.id, { value: 9 }); // corrigiu a nota
      assert.equal((await evaluationRow(ev.id)).nps_score, 9, 'a nota da avaliação acompanha a resposta');
    });

    it('valida alternativa, pergunta e formato da resposta', async () => {
      const ev = await start();
      const bad = async (questionId, body, pattern) => {
        const response = await put(ev, questionId, body);
        assert.equal(response.status, 400, `${questionId} ${JSON.stringify(body)} -> ${response.text}`);
        if (pattern) assert.match(response.body.error, pattern);
      };
      await bad(f.qReq.id, { value: 9 }, /Resposta inválida/); // fora das alternativas
      await bad(f.qReq.id, { value: 0 }, /Resposta inválida/);
      await bad(f.qOther.id, { value: 3 }, /Pergunta inválida/); // pergunta de outro setor
      await bad(f.qInactive.id, { value: 3 }, /Pergunta inválida/); // desativada
      await bad(f.qNoOptions.id, { value: 3 }, /Resposta inválida/);
      await bad('nao-e-um-uuid', { value: 3 }, /Pergunta inválida/);
      await bad('00000000-0000-4000-8000-000000000000', { value: 3 }, /Pergunta inválida/);
      await bad(f.qReq.id, {});
      await bad(f.qReq.id, { value: '3' });
      await bad(f.qReq.id, { value: 1.5 });
      await bad(f.qReq.id, { skipped: false });
      await bad(f.qReq.id, { skipped: 'sim' });
      assert.equal((await answersOf(ev.id)).length, 0, 'nenhuma resposta inválida foi gravada');
    });
  });

  // ------------------------------------------------------ interrupção
  describe('pesquisa interrompida', () => {
    it('as respostas já salvas são preservadas e a avaliação continua incompleta', async () => {
      const ev = await start();
      await answerRequired(ev, 3);
      await put(ev, f.qOpt.id, { value: 2 });
      // a pessoa fecha a aba aqui: nada mais é enviado

      const row = await evaluationRow(ev.id);
      assert.equal(row.status, 'incomplete');
      assert.equal(row.completed_at, null);
      assert.equal(row.nps_score, null);
      const kept = await answersOf(ev.id);
      assert.deepEqual(kept.map((a) => a.value).sort(), [2, 3], 'as respostas permanecem gravadas');
      assert.equal(await caseOf(ev.id), undefined);

      // Nada é apagado: com o token, é possível até retomar depois.
      await put(ev, f.nps.id, { value: 9 });
      assert.equal((await finish(ev)).status, 200);
      assert.equal((await answersOf(ev.id)).length, 3);
    });

    it('avaliação abandonada com nota baixa e feedback não enviado não gera atendimento', async () => {
      const ev = await start();
      await answerRequired(ev);
      await put(ev, f.nps.id, { value: 2 });
      assert.equal((await evaluationRow(ev.id)).status, 'incomplete');
      assert.equal(await caseOf(ev.id), undefined);
      assert.equal((await evaluationRow(ev.id)).nps_score, 2, 'a nota salva continua disponível');
    });
  });

  // --------------------------------------- feedback à ouvidoria (NPS)
  describe('feedback à ouvidoria', () => {
    const feedback = (extra = {}) => ({
      feedback: { type: 'reclamacao', message: '  Esperei muito tempo.  ', contactRequested: true, phone: '51912345678', consent: true, ...extra },
    });

    async function evaluationWithNps(nps) {
      const ev = await start();
      await answerRequired(ev);
      await put(ev, f.nps.id, { value: nps });
      return ev;
    }

    it('nota 6: pode enviar feedback com retorno; gera atendimento com código e consentimento', async () => {
      const ev = await evaluationWithNps(6);
      const result = await finish(ev, feedback());
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, { completed: true, feedbackSent: true });
      assert.doesNotMatch(result.text, /OUV-/, 'o código do atendimento não é devolvido ao respondente');

      const saved = await caseOf(ev.id);
      assert.match(saved.code, /^OUV-\d{4}-\d{6}$/);
      assert.equal(saved.message, 'Esperei muito tempo.');
      assert.equal(saved.feedback_type, 'reclamacao');
      assert.equal(saved.contact_requested, true);
      assert.equal(saved.phone, '51912345678');
      assert.equal(saved.consent_given, true);
      assert.ok(saved.consent_at);
      assert.equal(saved.status, 'open');
      assert.equal((await evaluationRow(ev.id)).status, 'completed');
    });

    it('nota 6 também pode concluir sem enviar feedback', async () => {
      const ev = await evaluationWithNps(6);
      assert.deepEqual((await finish(ev)).body, { completed: true, feedbackSent: false });
      assert.equal(await caseOf(ev.id), undefined);
      assert.equal((await evaluationRow(ev.id)).status, 'completed');
    });

    it('nota 7: o feedback é recusado, não gera atendimento e a avaliação segue concluível sem ele', async () => {
      const ev = await evaluationWithNps(7);
      const rejected = await finish(ev, feedback());
      assert.equal(rejected.status, 400);
      assert.match(rejected.body.error, /notas de 0 a 6/);
      assert.equal(await caseOf(ev.id), undefined);
      assert.equal((await evaluationRow(ev.id)).status, 'incomplete', 'nada foi concluído pela metade');

      assert.deepEqual((await finish(ev)).body, { completed: true, feedbackSent: false });
      assert.equal(await caseOf(ev.id), undefined);
    });

    it('notas 8, 9 e 10 também não aceitam feedback', async () => {
      for (const nps of [8, 9, 10]) {
        const ev = await evaluationWithNps(nps);
        assert.equal((await finish(ev, feedback())).status, 400, `nota ${nps}`);
        assert.equal(await caseOf(ev.id), undefined);
      }
    });

    it('nota baixa conclui sem feedback; texto em branco não vira atendimento', async () => {
      const a = await evaluationWithNps(3);
      assert.equal((await finish(a)).status, 200);
      assert.equal(await caseOf(a.id), undefined);

      const b = await evaluationWithNps(0);
      const blank = await finish(b, { feedback: { message: '   ', contactRequested: false } });
      assert.deepEqual(blank.body, { completed: true, feedbackSent: false });
      assert.equal(await caseOf(b.id), undefined);
    });

    it('feedback anônimo: gera atendimento sem celular e sem consentimento', async () => {
      const ev = await evaluationWithNps(4);
      const result = await finish(ev, { feedback: { type: 'sugestao', message: 'Mais cadeiras.', contactRequested: false } });
      assert.equal(result.status, 200);
      const saved = await caseOf(ev.id);
      assert.deepEqual([saved.contact_requested, saved.phone, saved.consent_given, saved.consent_at], [false, null, false, null]);
    });

    it('feedback sem tipo escolhido é aceito (o tipo é opcional)', async () => {
      const ev = await evaluationWithNps(5);
      assert.equal((await finish(ev, { feedback: { message: 'Sem tipo.', contactRequested: false } })).status, 200);
      assert.equal((await caseOf(ev.id)).feedback_type, null);
    });

    it('retorno exige celular e consentimento; anônimo não aceita celular; nada é gravado pela metade', async () => {
      const ev = await evaluationWithNps(2);
      const refuse = async (extra, pattern) => {
        const response = await finish(ev, feedback(extra));
        assert.equal(response.status, 400, response.text);
        if (pattern) assert.match(response.text, pattern);
        assert.equal(await caseOf(ev.id), undefined);
        assert.equal((await evaluationRow(ev.id)).status, 'incomplete');
      };
      await refuse({ consent: false }, /CONSENT_REQUIRED|autorizar/);
      await refuse({ consent: undefined }, /CONSENT_REQUIRED|autorizar/);
      await refuse({ phone: undefined }, /celular/);
      await refuse({ phone: '123' }, /Celular inválido/);
      await refuse({ phone: '5191234567' }, /Celular inválido/);
      await refuse({ contactRequested: false, phone: '51912345678', consent: undefined }, /anônimo/);
      await refuse({ contactRequested: false, phone: undefined, consent: true }, /anônimo/);
      await refuse({ message: 'x'.repeat(1001) });
      await refuse({ type: 'xingamento' });

      // depois dos erros, o envio correto funciona
      assert.equal((await finish(ev, feedback())).status, 200);
      assert.ok(await caseOf(ev.id));
    });

    it('o consentimento só vale para o feedback: não impede concluir sem reclamação', async () => {
      const ev = await evaluationWithNps(1);
      // pessoa abriu o contato, não deu consentimento e desistiu do feedback: conclui normalmente
      assert.equal((await finish(ev)).status, 200);
      assert.equal(await caseOf(ev.id), undefined);
    });
  });

  // ------------------------------------------------ turno, equipe, data
  describe('data, horário, turno e equipe', () => {
    const create = (body) => call('POST', `/api/public/surveys/${SLUG}/evaluations`, { body });

    it('exige o horário OU o turno, e uma data válida que não seja futura', async () => {
      assert.equal((await create({ visitDate: PAST_DATE })).status, 400);
      assert.equal((await create({ shiftId: f.tarde.id })).status, 400);
      assert.equal((await create({ visitDate: '2026-02-30', shiftId: f.tarde.id })).status, 400);
      assert.equal((await create({ visitDate: 'ontem', shiftId: f.tarde.id })).status, 400);
      assert.equal((await create({ visitDate: PAST_DATE, visitTime: '25:99' })).status, 400);
      const future = await create({ visitDate: '2999-01-01', shiftId: f.tarde.id });
      assert.equal(future.status, 400);
      assert.match(future.body.error, /futura/);
      assert.equal((await create({ visitDate: PAST_DATE, visitTime: '14:30' })).status, 201, 'só o horário basta');
      assert.equal((await create({ visitDate: PAST_DATE, shiftId: f.tarde.id })).status, 201, 'só o turno basta');
    });

    it('o turno escolhido precisa estar entre os cadastrados e ativos', async () => {
      assert.equal((await create({ visitDate: PAST_DATE, shiftId: f.inactiveShift.id })).status, 400);
      assert.equal((await create({ visitDate: PAST_DATE, shiftId: '00000000-0000-4000-8000-000000000000' })).status, 400);
      assert.equal((await create({ visitDate: PAST_DATE, shiftId: 'abc' })).status, 400);
    });

    it('o horário define o turno cadastrado (inclusive depois da meia-noite) e a equipe única do turno', async () => {
      const afternoon = await start({ shiftId: undefined, visitTime: '16:00' });
      let row = await evaluationRow(afternoon.id);
      assert.equal(row.shift_id, f.tarde.id);
      assert.equal(row.team_id, f.teamTarde.id, 'uma única equipe no turno: atribuída');

      const night = await start({ shiftId: undefined, visitTime: '23:30' });
      assert.equal((await evaluationRow(night.id)).shift_id, f.noite.id);
      const dawn = await start({ shiftId: undefined, visitTime: '03:00' });
      assert.equal((await evaluationRow(dawn.id)).shift_id, f.noite.id);

      // Horário e escolha divergentes: o horário vence.
      const conflict = await start({ shiftId: f.manha.id, visitTime: '16:00' });
      row = await evaluationRow(conflict.id);
      assert.equal(row.shift_id, f.tarde.id);
      assert.equal(row.visit_time.slice(0, 5), '16:00');
    });

    it('com mais de uma equipe possível (A e B), a equipe fica em aberto; sem equipe cadastrada também', async () => {
      const noite = await start({ shiftId: f.noite.id });
      const row = await evaluationRow(noite.id);
      assert.equal(row.shift_id, f.noite.id);
      assert.equal(row.team_id, null, 'não atribui arbitrariamente');

      const manha = await start({ shiftId: f.manha.id });
      assert.equal((await evaluationRow(manha.id)).team_id, null);
    });

    it('corrigir data/horário/turno ao voltar atualiza a avaliação enquanto estiver em andamento', async () => {
      const ev = await start({ shiftId: f.noite.id });
      const update = await call('PUT', `/api/public/evaluations/${ev.id}/visit`, {
        token: ev.token,
        body: { visitDate: '2026-01-16', visitTime: '10:15' },
      });
      assert.equal(update.status, 200);
      const row = await evaluationRow(ev.id);
      assert.equal(row.shift_id, f.manha.id);
      assert.equal(String(row.visit_date.toISOString?.().slice(0, 10) ?? row.visit_date), '2026-01-16');
      assert.equal(row.status, 'incomplete');

      assert.equal((await call('PUT', `/api/public/evaluations/${ev.id}/visit`, { token: ev.token, body: { visitDate: PAST_DATE } })).status, 400);
    });
  });

  // ---------------------------------------------------------- segurança
  describe('o respondente alcança só a própria avaliação', () => {
    it('id e token precisam bater: qualquer outra combinação recebe a mesma resposta (404)', async () => {
      const mine = await start();
      const other = await start();
      const attempts = [
        () => call('PUT', `/api/public/evaluations/${mine.id}/answers/${f.qReq.id}`, { body: { value: 3 } }), // sem token
        () => call('PUT', `/api/public/evaluations/${mine.id}/answers/${f.qReq.id}`, { token: other.token, body: { value: 3 } }), // token de outra pessoa
        () => call('PUT', `/api/public/evaluations/${mine.id}/answers/${f.qReq.id}`, { token: 'x'.repeat(43), body: { value: 3 } }),
        () => call('PUT', `/api/public/evaluations/${mine.id}/answers/${f.qReq.id}`, { token: 'curto', body: { value: 3 } }),
        () => call('PUT', `/api/public/evaluations/00000000-0000-4000-8000-000000000000/answers/${f.qReq.id}`, { token: mine.token, body: { value: 3 } }),
        () => call('PUT', `/api/public/evaluations/nao-e-uuid/answers/${f.qReq.id}`, { token: mine.token, body: { value: 3 } }),
        () => call('POST', `/api/public/evaluations/${mine.id}/finish`, { token: other.token, body: {} }),
        () => call('PUT', `/api/public/evaluations/${mine.id}/visit`, { token: other.token, body: { visitDate: PAST_DATE, shiftId: f.tarde.id } }),
      ];
      const results = [];
      for (const attempt of attempts) results.push(await attempt()); // em sequência (uma só conexão de teste)
      for (const response of results) assert.equal(response.status, 404);
      assert.equal(new Set(results.map((r) => r.text)).size, 1, 'mesma resposta em todos os casos');
      assert.equal((await answersOf(mine.id)).length, 0);
      assert.equal((await answersOf(other.id)).length, 0);
    });

    it('o banco guarda só o hash do token, nunca o token', async () => {
      const ev = await start();
      const row = await evaluationRow(ev.id);
      assert.equal(row.access_token_hash.length, 32);
      assert.ok(!row.access_token_hash.toString('utf8').includes(ev.token));
      assert.ok(!JSON.stringify(row).includes(ev.token));
    });

    it('não existe rota pública para listar ou consultar avaliações, respostas ou resultados', async () => {
      const ev = await start();
      await answerRequired(ev);
      for (const path of [
        '/api/public/evaluations',
        `/api/public/evaluations/${ev.id}`,
        `/api/public/evaluations/${ev.id}/answers`,
        `/api/public/surveys/${SLUG}/evaluations`,
        '/api/public/results',
        '/api/public/dashboards',
        '/api/public/users',
      ]) {
        const response = await call('GET', path, { token: ev.token });
        assert.equal(response.status, 404, path);
      }
    });

    it('com o token da avaliação não se acessa a área privada (nem cookie, nem cabeçalho)', async () => {
      const ev = await start();
      for (const path of ['/api/admin/users', '/api/admin/sectors', '/api/admin/settings', '/api/auth/me']) {
        assert.equal((await call('GET', path, { token: ev.token, cookie: `hnps_session=${ev.token}` })).status, 401, path);
      }
    });
  });

  // -------------------------------------------------- setor desativado
  describe('setor desativado', () => {
    it('para de aceitar respostas e a pesquisa sai do ar; reativado, volta a funcionar', async () => {
      const ev = await start();
      await client.query(`update public.sectors set is_active = false where id = $1`, [f.sector.id]);
      try {
        const answer = await put(ev, f.qReq.id, { value: 3 });
        assert.equal(answer.status, 409);
        assert.equal(answer.body.code, 'SURVEY_UNAVAILABLE');
        assert.equal((await finish(ev)).status, 409);
        assert.equal((await call('GET', `/api/public/surveys/${SLUG}`)).status, 404);
        assert.equal((await answersOf(ev.id)).length, 0);
      } finally {
        await client.query(`update public.sectors set is_active = true where id = $1`, [f.sector.id]);
      }
      assert.equal((await put(ev, f.qReq.id, { value: 3 })).status, 200, 'o histórico e a avaliação seguem intactos');
    });
  });

  // ------------------------------------------------------- link legal
  describe('link do texto legal configurado pelo Super Admin', () => {
    async function login(username) {
      const response = await call('POST', '/api/auth/login', { body: { username, password: PASSWORD }, csrf: true });
      assert.equal(response.status, 200, response.text);
      return response.setCookie.map((c) => c.split(';')[0]).find((c) => c.startsWith('hnps_session='));
    }
    const setUrl = (cookie, url) =>
      call('PUT', '/api/admin/settings/privacy-policy-url', { cookie, csrf: true, body: { url } });

    it('o Super Admin define o link e a pesquisa passa a oferecê-lo', async () => {
      const cookie = await login('zz_test_admin');
      assert.deepEqual((await call('GET', '/api/admin/settings', { cookie })).body.settings, { privacyPolicyUrl: null });

      const saved = await setUrl(cookie, 'https://exemplo.org/politica-de-privacidade');
      assert.equal(saved.status, 200);
      assert.equal(saved.body.settings.privacyPolicyUrl, 'https://exemplo.org/politica-de-privacidade');
      assert.equal((await call('GET', `/api/public/surveys/${SLUG}`)).body.privacyPolicyUrl, 'https://exemplo.org/politica-de-privacidade');

      assert.equal((await setUrl(cookie, null)).status, 200);
      assert.equal((await call('GET', `/api/public/surveys/${SLUG}`)).body.privacyPolicyUrl, null);
    });

    it('só endereços http/https válidos são aceitos', async () => {
      const cookie = await login('zz_test_admin');
      for (const url of ['javascript:alert(1)', 'ftp://exemplo.org', 'exemplo.org/politica', '', '   ', 'https://com espaço.org']) {
        assert.equal((await setUrl(cookie, url)).status, 400, url);
      }
      assert.equal((await call('PUT', '/api/admin/settings/privacy-policy-url', { cookie, csrf: true, body: {} })).status, 400);
    });

    it('somente o Super Admin altera; gestor e visitante não', async () => {
      const gestor = await login('zz_test_gestor');
      assert.equal((await setUrl(gestor, 'https://exemplo.org/x')).status, 403);
      assert.equal((await call('GET', '/api/admin/settings', { cookie: gestor })).status, 403);
      assert.equal((await call('PUT', '/api/admin/settings/privacy-policy-url', { csrf: true, body: { url: 'https://exemplo.org/x' } })).status, 401);
      assert.equal((await call('GET', `/api/public/surveys/${SLUG}`)).body.privacyPolicyUrl, null);
    });
  });
});
