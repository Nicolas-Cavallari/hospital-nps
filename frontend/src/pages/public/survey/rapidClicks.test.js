import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRapidClickDetector } from './rapidClicks.js';

describe('aviso de cliques em excesso (mais de 5 em 3 segundos)', () => {
  it('cinco cliques seguidos não avisam; o sexto avisa', () => {
    const detector = createRapidClickDetector();
    for (let i = 0; i < 5; i += 1) assert.equal(detector.register(1000 + i * 100), false, `clique ${i + 1}`);
    assert.equal(detector.register(1500), true, 'sexto clique');
  });

  it('cliques espaçados (fora da janela de 3 segundos) nunca avisam', () => {
    const detector = createRapidClickDetector();
    for (let i = 0; i < 30; i += 1) assert.equal(detector.register(i * 700), false);
  });

  it('a janela desliza: cliques antigos deixam de contar', () => {
    const detector = createRapidClickDetector();
    for (let i = 0; i < 5; i += 1) detector.register(i * 100); // 0..400 ms
    assert.equal(detector.register(3300), false, 'os 5 primeiros já saíram da janela');
  });

  it('depois de avisar a contagem recomeça: não fica avisando sem parar nem bloqueia', () => {
    const detector = createRapidClickDetector();
    for (let i = 0; i < 5; i += 1) detector.register(i * 100);
    assert.equal(detector.register(500), true);
    for (let i = 0; i < 5; i += 1) assert.equal(detector.register(600 + i * 100), false);
    assert.equal(detector.register(1100), true, 'só avisa de novo após mais 6 cliques');
  });
});
