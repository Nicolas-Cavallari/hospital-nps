import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateNps, classifyNps } from '../src/services/nps.service.js';

describe('cálculo NPS', () => {
  it('classifica os limites das três faixas', () => {
    assert.deepEqual([0, 6, 7, 8, 9, 10].map(classifyNps), [
      'detractor', 'detractor', 'passive', 'passive', 'promoter', 'promoter',
    ]);
  });

  it('calcula promotores menos detratores sobre as respostas válidas', () => {
    assert.equal(calculateNps([10, 9, 8, 7, 6, 0]), 0);
    assert.equal(calculateNps([10, 9, 9, 8, 7, 6]), 33);
    assert.equal(calculateNps([0, 1, 6]), -100);
    assert.equal(calculateNps([]), null);
    assert.equal(calculateNps([11, -1]), null);
  });
});
