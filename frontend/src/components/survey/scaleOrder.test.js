import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sortForDisplay, usesEmojis } from './scaleOrder.js';

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => ({ value: from + i, label: null }));

describe('ordem das alternativas', () => {
  it('escala de 1 a 5: "muito bom" (5) à esquerda, diminuindo até o "muito ruim" (1) à direita', () => {
    assert.deepEqual(sortForDisplay(range(1, 5)).map((o) => o.value), [5, 4, 3, 2, 1]);
  });

  it('NPS: 10 à esquerda, diminuindo até 0 à direita', () => {
    assert.deepEqual(sortForDisplay(range(0, 10)).map((o) => o.value), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  it('não depende da ordem em que as alternativas chegam e não altera a lista original', () => {
    const shuffled = [{ value: 3 }, { value: 5 }, { value: 1 }, { value: 4 }, { value: 2 }];
    const copy = JSON.stringify(shuffled);
    assert.deepEqual(sortForDisplay(shuffled).map((o) => o.value), [5, 4, 3, 2, 1]);
    assert.equal(JSON.stringify(shuffled), copy);
  });

  it('mantém os rótulos das pontas junto de cada valor', () => {
    const sorted = sortForDisplay([{ value: 1, label: 'Muito ruim' }, { value: 2, label: null }, { value: 5, label: 'Excelente' }]);
    assert.equal(sorted[0].label, 'Excelente');
    assert.equal(sorted[sorted.length - 1].label, 'Muito ruim');
  });
});

describe('emojis só na escala padrão de 1 a 5', () => {
  it('usa emojis para 1 a 5 e números para qualquer outra escala', () => {
    assert.equal(usesEmojis(range(1, 5)), true);
    assert.equal(usesEmojis(sortForDisplay(range(1, 5))), true);
    assert.equal(usesEmojis(range(0, 10)), false, 'NPS mantém os números');
    assert.equal(usesEmojis(range(1, 3)), false);
    assert.equal(usesEmojis(range(1, 4)), false);
    assert.equal(usesEmojis(range(0, 4)), false);
    assert.equal(usesEmojis(range(2, 6)), false);
    assert.equal(usesEmojis([]), false);
  });
});
