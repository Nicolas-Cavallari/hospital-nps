/** Regras para descobrir o turno (pelo horário) e a equipe, usando só o que o hospital cadastrou. */

const toMinutes = (time) => {
  const [hours, minutes] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
};

/** O horário cabe no turno? Turnos que atravessam a meia-noite (início > fim) são tratados. */
export function shiftContains(shift, time) {
  const t = toMinutes(time);
  const start = toMinutes(shift.start_time);
  const end = toMinutes(shift.end_time);
  return start < end ? t >= start && t < end : t >= start || t < end;
}

/**
 * Define o turno e a equipe da avaliação.
 *  - O horário informado manda: se cair em exatamente um turno cadastrado, esse é o turno.
 *  - Sem horário (ou fora de qualquer turno), vale o turno escolhido pela pessoa.
 *  - A equipe só é atribuída quando há UMA equipe ativa no setor e turno; havendo mais de uma
 *    (ex.: Equipe A e B), fica em branco para o Super Admin decidir a regra, em vez de chutar.
 */
export function resolveShift({ shifts, chosenShiftId, visitTime }) {
  const chosen = chosenShiftId ? shifts.find((shift) => shift.id === chosenShiftId) ?? null : null;
  if (chosenShiftId && !chosen) return { invalidChoice: true };

  const byTime = visitTime ? shifts.filter((shift) => shiftContains(shift, visitTime)) : [];
  if (byTime.length === 1) return { shift: byTime[0] };
  if (byTime.length > 1 && chosen && byTime.some((shift) => shift.id === chosen.id)) return { shift: chosen };
  return { shift: byTime.length > 1 ? null : chosen };
}

export function pickTeam(teams) {
  return teams.length === 1 ? teams[0].id : null;
}
