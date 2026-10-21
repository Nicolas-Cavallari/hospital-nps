import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import * as permissions from '../src/config/permissions.js';

// Testes sem banco de dados: política de senha, permissões, proteção CSRF e sessão.
process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres-0123456789';

let password;
let csrf;
let tokens;

before(async () => {
  password = await import('../src/services/password.service.js');
  csrf = await import('../src/middlewares/csrf.js');
  tokens = await import('../src/services/token.service.js');
});

describe('política de senha', () => {
  it('aceita senhas que cumprem as regras e recusa as que não cumprem', () => {
    assert.deepEqual(password.passwordPolicyFailures('Abcdefg#123'), []);
    assert.ok(password.passwordPolicyFailures('curta1!A').length > 0, 'menos de 10 caracteres');
    assert.ok(password.passwordPolicyFailures('semmaiuscula1!').length > 0, 'sem maiúscula');
    assert.ok(password.passwordPolicyFailures('SEMMINUSCULA1!').length > 0, 'sem minúscula');
    assert.ok(password.passwordPolicyFailures('SemNumeroAqui!!').length > 0, 'sem número');
    assert.ok(password.passwordPolicyFailures('SemEspecial1234').length > 0, 'sem caractere especial');
    assert.ok(password.passwordPolicyFailures(`Aa1!${'x'.repeat(130)}`).length > 0, 'longa demais');
  });

  it('senhas temporárias geradas são fortes, diferentes entre si e cumprem a política', () => {
    const seen = new Set();
    for (let i = 0; i < 300; i += 1) {
      const generated = password.generateTemporaryPassword();
      assert.equal(generated.length, 16);
      assert.deepEqual(password.passwordPolicyFailures(generated), [], generated);
      seen.add(generated);
    }
    assert.equal(seen.size, 300);
  });

  it('guarda só hash argon2 e verifica a senha corretamente', async () => {
    const hash = await password.hashPassword('Abcdefg#123');
    assert.match(hash, /^\$argon2id\$/);
    assert.notEqual(hash, 'Abcdefg#123');
    assert.equal(await password.verifyPassword(hash, 'Abcdefg#123'), true);
    assert.equal(await password.verifyPassword(hash, 'Abcdefg#124'), false);
    assert.equal(await password.verifyPassword('isto-nao-e-um-hash', 'qualquer'), false);
  });
});

describe('matriz de permissões (conforme o relatório)', () => {
  const user = (role, sectorId = null) => ({ role, sectorId });
  const can = (role, permission) => permissions.hasPermission(user(role), permission);
  const { SUPER_ADMIN, GESTOR, OUVIDORIA } = permissions.ROLES;

  it('Super Admin tem acesso geral e administra; acompanha a ouvidoria sem atendê-la', () => {
    for (const permission of [
      'users:manage', 'settings:manage', 'teams-shifts:manage', 'nps-question:manage',
      'sectors:read:all', 'questions:manage:all', 'results:read:all', 'ouvidoria:read',
    ]) {
      assert.equal(can(SUPER_ADMIN, permission), true, permission);
    }
    assert.equal(can(SUPER_ADMIN, 'ouvidoria:handle'), false);
    assert.equal(can(SUPER_ADMIN, 'sectors:read:own'), false, 'o escopo "own" é só do gestor');
  });

  it('gestor só alcança o próprio setor e não tem funções administrativas', () => {
    for (const permission of ['sectors:read:own', 'questions:manage:own', 'results:read:own']) {
      assert.equal(can(GESTOR, permission), true, permission);
    }
    for (const permission of [
      'users:manage', 'settings:manage', 'teams-shifts:manage', 'nps-question:manage',
      'sectors:read:all', 'questions:manage:all', 'results:read:all', 'ouvidoria:read', 'ouvidoria:handle',
    ]) {
      assert.equal(can(GESTOR, permission), false, permission);
    }
  });

  it('ouvidoria atende e consulta, mas não gerencia perguntas, usuários nem configurações', () => {
    for (const permission of ['sectors:read:all', 'results:read:all', 'ouvidoria:read', 'ouvidoria:handle']) {
      assert.equal(can(OUVIDORIA, permission), true, permission);
    }
    for (const permission of [
      'users:manage', 'settings:manage', 'teams-shifts:manage', 'nps-question:manage',
      'questions:manage:all', 'questions:manage:own', 'sectors:read:own',
    ]) {
      assert.equal(can(OUVIDORIA, permission), false, permission);
    }
  });

  it('perfil desconhecido, ausente ou permissão inexistente não tem nada', () => {
    assert.equal(can('respondente', 'users:manage'), false);
    assert.equal(permissions.hasPermission(null, 'users:manage'), false);
    assert.equal(permissions.hasPermission(user(SUPER_ADMIN), 'permissao:inexistente'), false);
  });

  it('o alcance por setor do gestor é o setor dele; o dos demais é geral', () => {
    const opts = { allPermission: 'sectors:read:all', ownPermission: 'sectors:read:own' };
    assert.deepEqual(permissions.sectorScope(user(SUPER_ADMIN), opts), { all: true });
    assert.deepEqual(permissions.sectorScope(user(OUVIDORIA), opts), { all: true });
    assert.deepEqual(permissions.sectorScope(user(GESTOR, 'setor-1'), opts), { all: false, sectorId: 'setor-1' });
    assert.equal(permissions.sectorScope(user(GESTOR, null), opts), null, 'gestor sem setor não acessa nada');
    assert.equal(permissions.sectorScope(user('respondente'), opts), null);
  });
});

describe('proteção CSRF', () => {
  const run = (method, headers = {}) => {
    let received = 'não chamou';
    csrf.requireCsrfHeader({ method, get: (name) => headers[name.toLowerCase()] }, {}, (err) => {
      received = err ? err.status : 'passou';
    });
    return received;
  };

  it('operações que alteram dados exigem o cabeçalho; leituras não', () => {
    assert.equal(run('GET'), 'passou');
    assert.equal(run('POST'), 403);
    assert.equal(run('PATCH'), 403);
    assert.equal(run('DELETE'), 403);
    assert.equal(run('POST', { 'x-csrf-protection': '0' }), 403);
    assert.equal(run('POST', { 'x-csrf-protection': '1' }), 'passou');
  });
});

describe('sessão (JWT)', () => {
  it('assina e valida; recusa token adulterado ou lixo', () => {
    const token = tokens.signSession({ id: '8f7a7b1e-9a4c-4c43-8a4e-1c1a1f6f0b11', tokenVersion: 3 }, { remember: false });
    const payload = tokens.verifySession(token);
    assert.equal(payload.sub, '8f7a7b1e-9a4c-4c43-8a4e-1c1a1f6f0b11');
    assert.equal(payload.tv, 3);

    const [head, body, signature] = token.split('.');
    const forgedBody = Buffer.from(JSON.stringify({ ...payload, sub: 'outro' })).toString('base64url');
    assert.equal(tokens.verifySession(`${head}.${forgedBody}.${signature}`), null);
    assert.equal(tokens.verifySession('lixo'), null);
    assert.equal(tokens.verifySession(''), null);
  });

  it('cookie: HttpOnly, SameSite e duração conforme "manter neste dispositivo"', () => {
    const remembered = tokens.sessionCookieOptions({ remember: true });
    assert.equal(remembered.httpOnly, true);
    assert.equal(remembered.sameSite, 'lax');
    assert.equal(remembered.maxAge, 60 * 24 * 60 * 60 * 1000, '60 dias');
    assert.equal('maxAge' in tokens.sessionCookieOptions({ remember: false }), false, 'termina ao fechar o navegador');
  });
});
