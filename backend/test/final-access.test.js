import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.JWT_SECRET = 'segredo-exclusivo-da-suite-final-com-32-caracteres';
const { createApp } = await import('../src/app.js');
let server;
let base;
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));

test('rotas privadas negam acesso sem sessão e com cookie adulterado', async () => {
  for (const cookie of ['', 'hnps_session=adulterado']) {
    for (const [method, path] of [
      ['GET', '/admin/dashboard'], ['GET', '/admin/users'],
      ['POST', '/admin/users'], ['PATCH', '/admin/users/qualquer'],
      ['POST', '/admin/users/qualquer/reset-password'],
      ['GET', '/admin/sectors'], ['GET', '/admin/settings'],
      ['PUT', '/admin/settings/privacy-policy-url'],
      ['GET', '/admin/ouvidoria'], ['GET', '/admin/ouvidoria/qualquer'],
      ['POST', '/admin/ouvidoria/qualquer/attempts'],
      ['POST', '/admin/ouvidoria/qualquer/actions'],
      ['POST', '/admin/ouvidoria/qualquer/close'],
      ['GET', '/auth/me'], ['POST', '/auth/change-password'],
    ]) {
      const response = await fetch(`${base}/api${path}`, {
        method, headers: { cookie, 'x-csrf-protection': '1' },
      });
      assert.equal(response.status, 401, `${method} ${path}`);
      assert.deepEqual(Object.keys(await response.json()), ['error']);
    }
  }
});

test('não existem consultas públicas a respostas, resultados, usuários ou atendimentos', async () => {
  for (const path of ['evaluations', 'answers', 'results', 'users', 'ouvidoria']) {
    const response = await fetch(`${base}/api/public/${path}`);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});
