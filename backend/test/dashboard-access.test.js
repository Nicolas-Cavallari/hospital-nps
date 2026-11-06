import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getDashboard } from '../src/services/dashboard.service.js';

describe('escopo do dashboard', () => {
  it('bloqueia gestor ao solicitar o setor de outra pessoa', async () => {
    await assert.rejects(
      getDashboard({ role: 'gestor', sectorId: 'setor-a' }, { sectorId: 'setor-b' }),
      (error) => error.status === 403,
    );
  });

  it('não permite que perfil sem permissão use o endpoint', async () => {
    await assert.rejects(
      getDashboard({ role: 'visitante', sectorId: null }),
      (error) => error.status === 403,
    );
  });
});
