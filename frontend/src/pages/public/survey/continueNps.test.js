import assert from 'node:assert/strict';
import { test } from 'node:test';
import { continueNps } from './continueNps.js';

test('notas 0–6 seguem para feedback opcional, sem concluir antecipadamente', async () => {
  for (let score = 0; score <= 6; score++) {
    await continueNps(score, {
      finish: () => assert.fail('não deve concluir'),
      advance: (step) => assert.equal(step, 'nps'),
    });
  }
});

test('notas 7–10 precisam confirmar a conclusão, inclusive ao tentar novamente', async () => {
  for (let score = 7; score <= 10; score++) {
    let calls = 0;
    const actions = {
      finish: async (feedback) => { assert.equal(feedback, null); return ++calls > 1; },
      advance: () => assert.fail('não deve mostrar agradecimento sem confirmação'),
    };
    assert.equal(await continueNps(score, actions), false);
    assert.equal(await continueNps(score, actions), true);
    assert.equal(calls, 2);
  }
});

test('erro de rede não avança e nota ausente não conclui', async () => {
  const actions = {
    finish: async () => { throw new Error('offline'); },
    advance: () => assert.fail('não deve avançar'),
  };
  await assert.rejects(continueNps(9, actions), /offline/);
  for (const score of [null, undefined, -1, 11]) await continueNps(score, actions);
});
