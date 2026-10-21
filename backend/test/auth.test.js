import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';

/**
 * Testes de acesso autorizado e não autorizado, com a API rodando de verdade contra um banco.
 *
 * ATENÇÃO: use um banco de TESTE (TEST_DATABASE_URL), de preferência separado do banco real.
 * Os testes criam usuários e setores com prefixo "zz_test_" / "zz-test-" e os removem ao final
 * (e também no início, caso uma execução anterior tenha sido interrompida).
 * Exige as migrações já aplicadas. Executar: npm run test:auth
 */

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL?.trim();
const SECRET = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres-9876543210';

if (TEST_DATABASE_URL) {
  // Definidos ANTES de carregar a aplicação: o dotenv nunca sobrescreve variáveis já definidas,
  // então o banco real do arquivo .env jamais é usado por estes testes.
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_SECRET = SECRET;
}

const skipReason = TEST_DATABASE_URL
  ? false
  : 'TEST_DATABASE_URL não configurada (defina a URL de um banco de teste com as migrações aplicadas).';

const PASSWORD = 'Senha@Teste1234';

describe('autenticação e autorização (API)', { skip: skipReason }, () => {
  let server;
  let base;
  let db;
  let repo;
  let passwordService;
  let usersService;
  let tokenService;
  let envConfig;

  let sectorA;
  let sectorB;
  const u = {}; // usuários de teste

  async function call(method, path, { body, cookie, csrf = true, headers = {} } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      redirect: 'manual',
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(csrf ? { 'x-csrf-protection': '1' } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // resposta sem corpo
    }
    return { status: response.status, body: json, text, headers: response.headers, setCookie: response.headers.getSetCookie() };
  }

  const sessionCookieOf = (response) =>
    response.setCookie.map((c) => c.split(';')[0]).find((c) => c.startsWith(`${tokenService.SESSION_COOKIE}=`));

  async function login(username, password = PASSWORD, remember = false) {
    const response = await call('POST', '/api/auth/login', { body: { username, password, remember } });
    return { response, cookie: sessionCookieOf(response) };
  }

  /** Cria um usuário já pronto para uso (senha conhecida e sem troca pendente). */
  async function makeUser(username, role, sectorId = undefined) {
    const row = await repo.insert({
      username,
      fullName: `Teste ${username}`,
      role,
      sectorId,
      passwordHash: await passwordService.hashPassword(PASSWORD),
    });
    await repo.setPassword(row.id, { passwordHash: row.password_hash, mustChangePassword: false });
    return (await repo.findById(row.id));
  }

  const cleanup = async () => {
    await db.getPool().query(`delete from public.users where username like 'zz\\_test\\_%'`);
    await db.getPool().query(`delete from public.sectors where slug like 'zz-test-%'`);
  };

  before(async () => {
    db = await import('../src/config/db.js');
    repo = await import('../src/repositories/users.repository.js');
    passwordService = await import('../src/services/password.service.js');
    usersService = await import('../src/services/users.service.js');
    tokenService = await import('../src/services/token.service.js');
    envConfig = await import('../src/config/env.js');
    const { createApp } = await import('../src/app.js');

    const { rows } = await db.getPool().query(
      `select count(*)::int as n from pg_attribute
        where attrelid = 'public.users'::regclass and attname = 'token_version' and not attisdropped`,
    );
    assert.equal(rows[0].n, 1, 'Migração ausente: aplique as migrações antes (npm run db:migrate).');

    await cleanup();
    server = createApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;

    sectorA = (await db.getPool().query(`insert into public.sectors (name, slug) values ('Teste Setor A', 'zz-test-a') returning *`)).rows[0];
    sectorB = (await db.getPool().query(`insert into public.sectors (name, slug) values ('Teste Setor B', 'zz-test-b') returning *`)).rows[0];

    u.admin = await makeUser('zz_test_admin', 'super_admin');
    u.admin2 = await makeUser('zz_test_admin2', 'super_admin');
    u.gestorA = await makeUser('zz_test_gestor_a', 'gestor', sectorA.id);
    u.gestorB = await makeUser('zz_test_gestor_b', 'gestor', sectorB.id);
    u.ouvidoria = await makeUser('zz_test_ouvidoria', 'ouvidoria');
    u.inactive = await makeUser('zz_test_inativo', 'ouvidoria');
    await db.getPool().query(`update public.users set is_active = false where id = $1`, [u.inactive.id]);
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) {
      await cleanup();
      await db.closePool();
    }
  });

  // ------------------------------------------------------------------ login
  describe('login', () => {
    it('credenciais corretas abrem a sessão em cookie HttpOnly e não expõem o hash', async () => {
      const { response, cookie } = await login('zz_test_admin');
      assert.equal(response.status, 200);
      assert.ok(cookie, 'cookie de sessão definido');
      const header = response.setCookie.find((c) => c.startsWith(tokenService.SESSION_COOKIE));
      assert.match(header, /HttpOnly/i);
      assert.match(header, /SameSite=Lax/i);
      assert.equal(response.body.user.username, 'zz_test_admin');
      assert.equal(response.body.user.role, 'super_admin');
      assert.doesNotMatch(response.text, /argon2|password_hash|passwordHash|token_version/i);
    });

    it('o nome de usuário não diferencia maiúsculas de minúsculas', async () => {
      const { response } = await login('  ZZ_TEST_ADMIN ');
      assert.equal(response.status, 200);
    });

    it('"manter neste dispositivo" dura 60 dias; sem marcar, é cookie de sessão', async () => {
      const remembered = (await login('zz_test_admin', PASSWORD, true)).response.setCookie[0];
      assert.match(remembered, /Max-Age=5184000/i);
      const session = (await login('zz_test_admin', PASSWORD, false)).response.setCookie[0];
      assert.doesNotMatch(session, /Max-Age|Expires/i);
    });

    it('usuário inexistente, senha errada e conta desativada recebem a MESMA resposta', async () => {
      const unknown = await call('POST', '/api/auth/login', { body: { username: 'zz_test_nao_existe', password: PASSWORD } });
      const wrong = await call('POST', '/api/auth/login', { body: { username: 'zz_test_admin', password: 'SenhaErrada#99' } });
      const inactive = await call('POST', '/api/auth/login', { body: { username: 'zz_test_inativo', password: PASSWORD } });
      for (const response of [unknown, wrong, inactive]) {
        assert.equal(response.status, 401);
        assert.equal(sessionCookieOf(response), undefined, 'nenhuma sessão é criada');
      }
      assert.equal(unknown.text, wrong.text);
      assert.equal(unknown.text, inactive.text);
      assert.doesNotMatch(unknown.text, /existe|inativ|desativ|bloquead/i);
    });

    it('corpo inválido é recusado sem detalhes sobre contas', async () => {
      assert.equal((await call('POST', '/api/auth/login', { body: {} })).status, 400);
      assert.equal((await call('POST', '/api/auth/login', { body: { username: 'a', password: 123 } })).status, 400);
      assert.equal((await call('POST', '/api/auth/login', { body: { username: 'x'.repeat(5), password: 'y'.repeat(300) } })).status, 400);
    });

    it('sem JWT_SECRET configurado, o login fica indisponível (503), nunca aberto', async () => {
      const saved = envConfig.env.jwtSecret;
      envConfig.env.jwtSecret = null;
      try {
        const response = await call('POST', '/api/auth/login', { body: { username: 'zz_test_admin', password: PASSWORD } });
        assert.equal(response.status, 503);
        assert.equal(sessionCookieOf(response), undefined);
      } finally {
        envConfig.env.jwtSecret = saved;
      }
    });
  });

  // ------------------------------------------------ acesso sem autenticação
  describe('sem autenticação (visitante / respondente público)', () => {
    const protectedGets = [
      '/api/auth/me',
      '/api/admin/users',
      '/api/admin/users/00000000-0000-4000-8000-000000000000',
      '/api/admin/sectors',
      '/api/admin/ouvidoria',
      '/api/admin/qualquer-coisa-futura',
    ];

    for (const path of protectedGets) {
      it(`GET ${path} -> 401`, async () => {
        const response = await call('GET', path);
        assert.equal(response.status, 401);
        assert.deepEqual(Object.keys(response.body), ['error']);
      });
    }

    it('operações que alteram dados também exigem login', async () => {
      assert.equal((await call('POST', '/api/admin/users', { body: { username: 'zz_test_x', fullName: 'X', role: 'ouvidoria' } })).status, 401);
      assert.equal((await call('PATCH', '/api/admin/users/abc', { body: { isActive: false } })).status, 401);
      assert.equal((await call('POST', '/api/admin/users/abc/reset-password')).status, 401);
      assert.equal((await call('POST', '/api/auth/change-password', { body: { newPassword: 'Abcdefg#12345' } })).status, 401);
    });

    it('as rotas públicas de verificação continuam abertas e não revelam dados privados', async () => {
      assert.equal((await call('GET', '/api/health')).status, 200);
    });

    it('não há rota pública que dê acesso à área privada', async () => {
      assert.equal((await call('GET', '/api/public/users')).status, 404);
      assert.equal((await call('GET', '/api/public/admin/users')).status, 404);
    });
  });

  // -------------------------------------------- sessões forjadas ou inválidas
  describe('sessões inválidas', () => {
    const cookieWith = (token) => `${tokenService.SESSION_COOKIE}=${token}`;

    it('token assinado com outro segredo, "alg none", expirado, de versão antiga ou lixo -> 401', async () => {
      const sub = u.admin.id;
      const forged = jwt.sign({ sub, tv: u.admin.token_version }, 'outro-segredo-qualquer-com-mais-de-32-caracteres!');
      const noneAlg = jwt.sign({ sub, tv: u.admin.token_version }, '', { algorithm: 'none' });
      const expired = jwt.sign({ sub, tv: u.admin.token_version }, SECRET, { expiresIn: -10 });
      const oldVersion = jwt.sign({ sub, tv: u.admin.token_version + 5 }, SECRET);
      const unknownUser = jwt.sign({ sub: '00000000-0000-4000-8000-000000000000', tv: 0 }, SECRET);
      for (const token of [forged, noneAlg, expired, oldVersion, unknownUser, 'lixo', '']) {
        const response = await call('GET', '/api/auth/me', { cookie: cookieWith(token) });
        assert.equal(response.status, 401, `token aceito indevidamente: ${token.slice(0, 20)}`);
      }
    });

    it('um token válido só vale com o cookie certo (cabeçalho Authorization não é aceito)', async () => {
      const { cookie } = await login('zz_test_admin');
      const token = cookie.split('=')[1];
      const response = await call('GET', '/api/auth/me', { headers: { authorization: `Bearer ${token}` } });
      assert.equal(response.status, 401);
    });
  });

  // ---------------------------------------------------------------- CSRF
  describe('proteção CSRF', () => {
    it('com sessão válida, alterar dados sem o cabeçalho de proteção é recusado', async () => {
      const { cookie } = await login('zz_test_admin');
      const blocked = await call('POST', '/api/admin/users', {
        cookie,
        csrf: false,
        body: { username: 'zz_test_csrf', fullName: 'CSRF', role: 'ouvidoria' },
      });
      assert.equal(blocked.status, 403);
      assert.equal(blocked.body.code, 'CSRF');
      const { rows } = await db.getPool().query(`select 1 from public.users where username = 'zz_test_csrf'`);
      assert.equal(rows.length, 0, 'nada foi criado');
    });

    it('leituras não exigem o cabeçalho', async () => {
      const { cookie } = await login('zz_test_admin');
      assert.equal((await call('GET', '/api/auth/me', { cookie, csrf: false })).status, 200);
    });
  });

  // -------------------------------------------------- permissões por perfil
  describe('perfil e permissões nas rotas protegidas', () => {
    let sessions;
    before(async () => {
      sessions = {
        admin: (await login('zz_test_admin')).cookie,
        gestorA: (await login('zz_test_gestor_a')).cookie,
        gestorB: (await login('zz_test_gestor_b')).cookie,
        ouvidoria: (await login('zz_test_ouvidoria')).cookie,
      };
    });

    it('GET /me devolve o próprio usuário (sem hash)', async () => {
      const response = await call('GET', '/api/auth/me', { cookie: sessions.gestorA });
      assert.equal(response.status, 200);
      assert.equal(response.body.user.role, 'gestor');
      assert.equal(response.body.user.sectorId, sectorA.id);
      assert.equal(response.body.user.mustChangePassword, false);
      assert.doesNotMatch(response.text, /argon2|password_hash|passwordHash|token_version/i);
    });

    it('gerenciar usuários é só do Super Admin: gestor e ouvidoria recebem 403', async () => {
      const someId = u.gestorA.id;
      for (const who of ['gestorA', 'ouvidoria']) {
        const cookie = sessions[who];
        assert.equal((await call('GET', '/api/admin/users', { cookie })).status, 403, `${who} listou usuários`);
        assert.equal((await call('GET', `/api/admin/users/${someId}`, { cookie })).status, 403);
        assert.equal((await call('POST', '/api/admin/users', { cookie, body: { username: 'zz_test_hack', fullName: 'Hack', role: 'super_admin' } })).status, 403);
        assert.equal((await call('PATCH', `/api/admin/users/${someId}`, { cookie, body: { isActive: false } })).status, 403);
        assert.equal((await call('POST', `/api/admin/users/${someId}/reset-password`, { cookie })).status, 403);
      }
      const { rows } = await db.getPool().query(`select 1 from public.users where username = 'zz_test_hack'`);
      assert.equal(rows.length, 0, 'nenhum usuário foi criado por perfil sem permissão');
      assert.equal((await call('GET', `/api/admin/users/${someId}`, { cookie: sessions.admin })).status, 200);
    });

    it('um gestor não consegue se promover nem alterar a si mesmo pelas rotas de usuários', async () => {
      const response = await call('PATCH', `/api/admin/users/${u.gestorA.id}`, {
        cookie: sessions.gestorA,
        body: { sectorId: sectorB.id },
      });
      assert.equal(response.status, 403);
      assert.equal((await repo.findById(u.gestorA.id)).sector_id, sectorA.id);
    });

    it('setores: Super Admin e ouvidoria veem todos; o gestor vê somente o seu', async () => {
      const slugs = async (cookie) =>
        (await call('GET', '/api/admin/sectors', { cookie })).body.sectors.map((s) => s.slug).filter((s) => s.startsWith('zz-test-')).sort();

      assert.deepEqual(await slugs(sessions.admin), ['zz-test-a', 'zz-test-b']);
      assert.deepEqual(await slugs(sessions.ouvidoria), ['zz-test-a', 'zz-test-b']);
      assert.deepEqual(await slugs(sessions.gestorA), ['zz-test-a']);
      assert.deepEqual(await slugs(sessions.gestorB), ['zz-test-b']);
    });

    it('gestor não acessa outro setor trocando o identificador: resposta idêntica a "não existe"', async () => {
      const own = await call('GET', `/api/admin/sectors/${sectorA.id}`, { cookie: sessions.gestorA });
      assert.equal(own.status, 200);
      assert.equal(own.body.sector.slug, 'zz-test-a');

      const other = await call('GET', `/api/admin/sectors/${sectorB.id}`, { cookie: sessions.gestorA });
      const missing = await call('GET', '/api/admin/sectors/00000000-0000-4000-8000-000000000000', { cookie: sessions.gestorA });
      const malformed = await call('GET', '/api/admin/sectors/1%20OR%201=1', { cookie: sessions.gestorA });
      assert.equal(other.status, 404);
      assert.equal(other.text, missing.text, 'não revela que o setor existe');
      assert.equal(malformed.status, 404);
      assert.doesNotMatch(other.text, /zz-test-b|Teste Setor B/);

      assert.equal((await call('GET', `/api/admin/sectors/${sectorB.id}`, { cookie: sessions.admin })).status, 200);
      assert.equal((await call('GET', `/api/admin/sectors/${sectorB.id}`, { cookie: sessions.ouvidoria })).status, 200);
    });

    it('o alcance do gestor é lido do banco a cada requisição (mudar o setor vale na hora)', async () => {
      const move = await call('PATCH', `/api/admin/users/${u.gestorB.id}`, { cookie: sessions.admin, body: { sectorId: sectorA.id } });
      assert.equal(move.status, 200);
      try {
        assert.equal((await call('GET', `/api/admin/sectors/${sectorA.id}`, { cookie: sessions.gestorB })).status, 200);
        assert.equal((await call('GET', `/api/admin/sectors/${sectorB.id}`, { cookie: sessions.gestorB })).status, 404);
      } finally {
        await call('PATCH', `/api/admin/users/${u.gestorB.id}`, { cookie: sessions.admin, body: { sectorId: sectorB.id } });
      }
    });

    it('área da ouvidoria: gestor é barrado (403); ouvidoria e Super Admin passam pela proteção', async () => {
      assert.equal((await call('GET', '/api/admin/ouvidoria', { cookie: sessions.gestorA })).status, 403);
      // Autorizados: a proteção deixa passar; ainda não há endpoints nesta etapa (404, não 401/403).
      assert.equal((await call('GET', '/api/admin/ouvidoria', { cookie: sessions.ouvidoria })).status, 404);
      assert.equal((await call('GET', '/api/admin/ouvidoria', { cookie: sessions.admin })).status, 404);
    });
  });

  // ------------------------------------------- criação de usuários e senhas
  describe('criação de usuários pelo Super Admin', () => {
    let adminCookie;
    before(async () => {
      adminCookie = (await login('zz_test_admin')).cookie;
    });

    it('cria gestor com senha temporária, devolvida uma vez e guardada só como hash', async () => {
      const response = await call('POST', '/api/admin/users', {
        cookie: adminCookie,
        body: { username: 'ZZ_Test_Novo_Gestor', fullName: 'Novo Gestor', role: 'gestor', sectorId: sectorA.id },
      });
      assert.equal(response.status, 201);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.body.user.username, 'zz_test_novo_gestor', 'usuário normalizado em minúsculas');
      assert.equal(response.body.user.mustChangePassword, true);
      assert.deepEqual(passwordService.passwordPolicyFailures(response.body.temporaryPassword), []);

      const row = await repo.findByUsername('zz_test_novo_gestor');
      assert.match(row.password_hash, /^\$argon2id\$/);
      assert.ok(!row.password_hash.includes(response.body.temporaryPassword));
      assert.equal(await passwordService.verifyPassword(row.password_hash, response.body.temporaryPassword), true);
      assert.doesNotMatch(JSON.stringify((await call('GET', '/api/admin/users', { cookie: adminCookie })).body), /argon2|temporaryPassword/);
    });

    it('valida os dados: gestor exige setor, outros perfis não aceitam setor, usuário e perfil válidos', async () => {
      const create = (body) => call('POST', '/api/admin/users', { cookie: adminCookie, body });
      assert.equal((await create({ username: 'zz_test_v1', fullName: 'V', role: 'gestor' })).status, 400);
      assert.equal((await create({ username: 'zz_test_v2', fullName: 'V', role: 'ouvidoria', sectorId: sectorA.id })).status, 400);
      assert.equal((await create({ username: 'zz_test_v3', fullName: 'V', role: 'respondente' })).status, 400);
      assert.equal((await create({ username: 'Inválido!', fullName: 'V', role: 'ouvidoria' })).status, 400);
      assert.equal((await create({ username: 'zz_test_v4', fullName: '  ', role: 'ouvidoria' })).status, 400);
      assert.equal((await create({ username: 'zz_test_v5', fullName: 'V', role: 'gestor', sectorId: '00000000-0000-4000-8000-000000000000' })).status, 400);
      const { rows } = await db.getPool().query(`select 1 from public.users where username like 'zz\\_test\\_v%'`);
      assert.equal(rows.length, 0);
    });

    it('nome de usuário repetido -> 409', async () => {
      const response = await call('POST', '/api/admin/users', {
        cookie: adminCookie,
        body: { username: 'zz_test_ouvidoria', fullName: 'Duplicado', role: 'ouvidoria' },
      });
      assert.equal(response.status, 409);
    });

    it('o perfil é definido pelo banco, não pelo cliente: campos extras são ignorados', async () => {
      const response = await call('POST', '/api/admin/users', {
        cookie: adminCookie,
        body: { username: 'zz_test_extra', fullName: 'Extra', role: 'ouvidoria', isActive: false, mustChangePassword: false, passwordHash: 'x', password: 'y' },
      });
      assert.equal(response.status, 201);
      const row = await repo.findByUsername('zz_test_extra');
      assert.equal(row.must_change_password, true);
      assert.equal(row.is_active, true);
      assert.match(row.password_hash, /^\$argon2id\$/);
    });
  });

  // --------------------------------------- troca da senha temporária (1º acesso)
  describe('senha temporária e troca no primeiro acesso', () => {
    let adminCookie;
    before(async () => {
      adminCookie = (await login('zz_test_admin')).cookie;
    });

    async function newTemporaryUser(username, role = 'gestor') {
      const response = await call('POST', '/api/admin/users', {
        cookie: adminCookie,
        body: { username, fullName: `Temp ${username}`, role, ...(role === 'gestor' ? { sectorId: sectorA.id } : {}) },
      });
      assert.equal(response.status, 201);
      return { id: response.body.user.id, temp: response.body.temporaryPassword };
    }

    it('com senha temporária só é possível ver "me", trocar a senha e sair; o resto é bloqueado', async () => {
      const { temp } = await newTemporaryUser('zz_test_primeiro_acesso');
      const { response, cookie } = await login('zz_test_primeiro_acesso', temp);
      assert.equal(response.status, 200);
      assert.equal(response.body.user.mustChangePassword, true);

      assert.equal((await call('GET', '/api/auth/me', { cookie })).status, 200);
      for (const path of ['/api/admin/sectors', `/api/admin/sectors/${sectorA.id}`, '/api/admin/users', '/api/admin/ouvidoria']) {
        const blocked = await call('GET', path, { cookie });
        assert.equal(blocked.status, 403, path);
        assert.equal(blocked.body.code, 'PASSWORD_CHANGE_REQUIRED');
      }
      assert.equal((await call('POST', '/api/auth/logout', { cookie })).status, 204);
    });

    it('troca a senha: recusa fraca ou igual à temporária; aceita forte; sessões antigas caem', async () => {
      const { temp } = await newTemporaryUser('zz_test_troca');
      const { cookie: oldCookie } = await login('zz_test_troca', temp);
      const change = (body, cookie = oldCookie) => call('POST', '/api/auth/change-password', { cookie, body });

      assert.equal((await change({ newPassword: 'fraca' })).status, 400);
      assert.equal((await change({ newPassword: 'semnumeroouespecial' })).status, 400);
      assert.equal((await change({ newPassword: temp })).status, 400, 'não pode repetir a temporária');
      assert.equal((await change({})).status, 400);

      const ok = await change({ newPassword: 'NovaSenha#2026ok' });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.user.mustChangePassword, false);
      const newCookie = sessionCookieOf(ok);
      assert.ok(newCookie);
      assert.doesNotMatch(ok.text, /argon2|NovaSenha/);

      assert.equal((await call('GET', '/api/auth/me', { cookie: oldCookie })).status, 401, 'sessão anterior invalidada');
      assert.equal((await call('GET', '/api/admin/sectors', { cookie: newCookie })).status, 200, 'a nova sessão acessa normalmente');
      assert.equal((await login('zz_test_troca', temp)).response.status, 401, 'a temporária deixou de valer');
      assert.equal((await login('zz_test_troca', 'NovaSenha#2026ok')).response.status, 200);
    });

    it('depois da primeira troca, trocar de novo exige a senha atual', async () => {
      const { cookie } = await login('zz_test_gestor_a');
      const change = (body) => call('POST', '/api/auth/change-password', { cookie, body });
      assert.equal((await change({ newPassword: 'OutraSenha#2026ok' })).status, 400, 'sem a senha atual');
      assert.equal((await change({ currentPassword: 'errada', newPassword: 'OutraSenha#2026ok' })).status, 400);
      assert.equal((await change({ currentPassword: PASSWORD, newPassword: PASSWORD })).status, 400, 'igual à atual');
      assert.equal((await change({ currentPassword: PASSWORD, newPassword: 'OutraSenha#2026ok' })).status, 200);
      // devolve a senha original para os demais testes
      const { cookie: fresh } = await login('zz_test_gestor_a', 'OutraSenha#2026ok');
      const back = await call('POST', '/api/auth/change-password', { cookie: fresh, body: { currentPassword: 'OutraSenha#2026ok', newPassword: PASSWORD } });
      assert.equal(back.status, 200);
    });

    it('o Super Admin redefine a senha de outro usuário; a pessoa precisa trocá-la de novo', async () => {
      const { temp, id } = await newTemporaryUser('zz_test_redefinir', 'ouvidoria');
      const { cookie: oldCookie } = await login('zz_test_redefinir', temp);
      const first = await call('POST', '/api/auth/change-password', { cookie: oldCookie, body: { newPassword: 'SenhaDoUsuario#1' } });
      const userCookie = sessionCookieOf(first);
      assert.equal((await call('GET', '/api/admin/sectors', { cookie: userCookie })).status, 200);

      const reset = await call('POST', `/api/admin/users/${id}/reset-password`, { cookie: adminCookie });
      assert.equal(reset.status, 200);
      assert.equal(reset.headers.get('cache-control'), 'no-store');
      assert.deepEqual(passwordService.passwordPolicyFailures(reset.body.temporaryPassword), []);

      assert.equal((await call('GET', '/api/auth/me', { cookie: userCookie })).status, 401, 'sessões abertas caem');
      assert.equal((await login('zz_test_redefinir', 'SenhaDoUsuario#1')).response.status, 401, 'senha antiga deixou de valer');
      const again = await login('zz_test_redefinir', reset.body.temporaryPassword);
      assert.equal(again.response.body.user.mustChangePassword, true);
    });

    it('o Super Admin não redefine a própria senha por essa rota', async () => {
      const response = await call('POST', `/api/admin/users/${u.admin.id}/reset-password`, { cookie: adminCookie });
      assert.equal(response.status, 400);
      assert.equal((await call('GET', '/api/auth/me', { cookie: adminCookie })).status, 200, 'a sessão continua válida');
    });
  });

  // ------------------------------------------------ desativação e proteção
  describe('desativar contas', () => {
    it('conta desativada perde o acesso na hora e não consegue entrar de novo', async () => {
      const adminCookie = (await login('zz_test_admin')).cookie;
      const created = await makeUser('zz_test_vai_sair', 'gestor', sectorA.id);
      const { cookie } = await login('zz_test_vai_sair');
      assert.equal((await call('GET', '/api/admin/sectors', { cookie })).status, 200);

      const off = await call('PATCH', `/api/admin/users/${created.id}`, { cookie: adminCookie, body: { isActive: false } });
      assert.equal(off.status, 200);
      assert.equal(off.body.user.isActive, false);

      assert.equal((await call('GET', '/api/admin/sectors', { cookie })).status, 401, 'sessão aberta cai na hora');
      assert.equal((await login('zz_test_vai_sair')).response.status, 401);
    });

    it('o Super Admin não desativa a própria conta', async () => {
      const adminCookie = (await login('zz_test_admin')).cookie;
      const response = await call('PATCH', `/api/admin/users/${u.admin.id}`, { cookie: adminCookie, body: { isActive: false } });
      assert.equal(response.status, 400);
      assert.equal((await repo.findById(u.admin.id)).is_active, true);
    });

    it('nunca fica sem Super Admin ativo', async (t) => {
      const { rows } = await db.getPool().query(
        `select count(*)::int as n from public.users where role = 'super_admin' and is_active and username not like 'zz\\_test\\_%'`,
      );
      if (rows[0].n > 0) {
        t.skip('Há Super Admin real neste banco; teste executado só em banco de teste.');
        return;
      }
      // Mantém um só ativo (admin2) e tenta desativá-lo por outra pessoa autorizada (admin).
      await db.getPool().query(`update public.users set is_active = false where id = $1`, [u.admin.id]);
      try {
        await assert.rejects(
          usersService.updateUser({ id: u.admin.id }, u.admin2.id, { isActive: false }),
          /ao menos um Super Admin ativo/,
        );
        assert.equal((await repo.findById(u.admin2.id)).is_active, true);
      } finally {
        await db.getPool().query(`update public.users set is_active = true where id = $1`, [u.admin.id]);
      }
    });

    it('PATCH valida os campos e ignora tentativas de mudar perfil ou senha', async () => {
      const adminCookie = (await login('zz_test_admin')).cookie;
      const target = u.ouvidoria.id;
      assert.equal((await call('PATCH', `/api/admin/users/${target}`, { cookie: adminCookie, body: {} })).status, 400);
      assert.equal((await call('PATCH', `/api/admin/users/${target}`, { cookie: adminCookie, body: { sectorId: sectorA.id } })).status, 400, 'só gestor tem setor');
      assert.equal((await call('PATCH', '/api/admin/users/unknown-id', { cookie: adminCookie, body: { isActive: true } })).status, 404);

      const changed = await call('PATCH', `/api/admin/users/${target}`, {
        cookie: adminCookie,
        body: { fullName: 'Nome Novo', role: 'super_admin', passwordHash: 'x' },
      });
      assert.equal(changed.status, 200);
      assert.equal(changed.body.user.fullName, 'Nome Novo');
      assert.equal((await repo.findById(target)).role, 'ouvidoria', 'perfil não muda por esta rota');
    });
  });

  // --------------------------------------------------------------- logout
  describe('logout', () => {
    it('apaga o cookie de sessão', async () => {
      const { cookie } = await login('zz_test_admin');
      const response = await call('POST', '/api/auth/logout', { cookie });
      assert.equal(response.status, 204);
      assert.match(response.setCookie.join(';'), new RegExp(`${tokenService.SESSION_COOKIE}=;`));
    });
  });
});
