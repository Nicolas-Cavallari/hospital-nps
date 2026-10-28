import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickTeam, resolveShift, shiftContains } from '../src/services/shift-team.service.js';

// Testes sem banco: descoberta de turno pelo horário e escolha da equipe.
const shift = (id, start, end) => ({ id, name: id, start_time: start, end_time: end });
const MANHA = shift('manha', '07:00:00', '13:00:00');
const TARDE = shift('tarde', '13:00:00', '19:00:00');
const NOITE = shift('noite', '19:00:00', '07:00:00'); // atravessa a meia-noite
const SHIFTS = [MANHA, TARDE, NOITE];

describe('turno pelo horário', () => {
  it('reconhece o turno de cada horário, incluindo a virada da meia-noite', () => {
    assert.equal(shiftContains(MANHA, '07:00'), true);
    assert.equal(shiftContains(MANHA, '12:59'), true);
    assert.equal(shiftContains(MANHA, '13:00'), false, 'o fim do turno é exclusivo');
    assert.equal(shiftContains(TARDE, '16:00'), true);
    assert.equal(shiftContains(NOITE, '19:00'), true);
    assert.equal(shiftContains(NOITE, '23:59'), true);
    assert.equal(shiftContains(NOITE, '00:00'), true);
    assert.equal(shiftContains(NOITE, '06:59'), true);
    assert.equal(shiftContains(NOITE, '07:00'), false);
    assert.equal(shiftContains(NOITE, '12:00'), false);
  });

  it('o horário informado define o turno; sem horário, vale a escolha da pessoa', () => {
    assert.equal(resolveShift({ shifts: SHIFTS, visitTime: '16:00' }).shift.id, 'tarde');
    assert.equal(resolveShift({ shifts: SHIFTS, visitTime: '02:30' }).shift.id, 'noite');
    assert.equal(resolveShift({ shifts: SHIFTS, chosenShiftId: 'manha' }).shift.id, 'manha');
    // horário e escolha divergentes: o horário (mais preciso) vence
    assert.equal(resolveShift({ shifts: SHIFTS, chosenShiftId: 'manha', visitTime: '16:00' }).shift.id, 'tarde');
  });

  it('escolha inválida é sinalizada; horário fora de qualquer turno usa a escolha', () => {
    assert.equal(resolveShift({ shifts: SHIFTS, chosenShiftId: 'inexistente' }).invalidChoice, true);
    const gap = [MANHA, TARDE];
    assert.equal(resolveShift({ shifts: gap, visitTime: '22:00' }).shift, null);
    assert.equal(resolveShift({ shifts: gap, visitTime: '22:00', chosenShiftId: 'tarde' }).shift.id, 'tarde');
  });

  it('turnos sobrepostos: usa a escolha se ela estiver entre eles; senão, não adivinha', () => {
    const overlap = [shift('a', '08:00', '14:00'), shift('b', '12:00', '18:00')];
    assert.equal(resolveShift({ shifts: overlap, visitTime: '13:00', chosenShiftId: 'b' }).shift.id, 'b');
    assert.equal(resolveShift({ shifts: overlap, visitTime: '13:00' }).shift, null);
  });
});

describe('equipe', () => {
  it('atribui só quando há exatamente uma equipe possível', () => {
    assert.equal(pickTeam([{ id: 't1' }]), 't1');
    assert.equal(pickTeam([]), null);
    assert.equal(pickTeam([{ id: 'a' }, { id: 'b' }]), null, 'Equipe A e B no mesmo turno: em aberto');
  });
});
