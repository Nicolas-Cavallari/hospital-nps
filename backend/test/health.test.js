import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';

describe('endpoints de verificação', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = createApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  it('GET /api/health responde 200 com status ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, 'ok');
  });

  it('GET /api/health/db responde 503 "not_configured" quando não há DATABASE_URL', async (t) => {
    if (process.env.DATABASE_URL) {
      t.skip('DATABASE_URL definida neste ambiente.');
      return;
    }
    const res = await fetch(`${baseUrl}/api/health/db`);
    const body = await res.json();
    assert.equal(res.status, 503);
    assert.equal(body.database, 'not_configured');
  });

  it('rota inexistente responde 404 em JSON', async () => {
    const res = await fetch(`${baseUrl}/api/nao-existe`);
    assert.equal(res.status, 404);
    assert.ok((await res.json()).error);
  });
});
