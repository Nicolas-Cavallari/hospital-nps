/**
 * Avaliação de senha apenas para o feedback visual da tela.
 * A regra de verdade será aplicada no backend na etapa de autenticação.
 */
export function evaluatePassword(password) {
  const hasLower = /\p{Ll}/u.test(password);
  const hasUpper = /\p{Lu}/u.test(password);
  const hasNumber = /\p{N}/u.test(password);
  const hasSpecial = /[^\p{L}\p{N}\s]/u.test(password);
  const longEnough = password.length >= 10;

  const rules = {
    length: longEnough,
    mixedCase: hasLower && hasUpper,
    numberAndSpecial: hasNumber && hasSpecial,
  };

  // Barras de força: 1 ponto por critério atendido (tamanho, maiúscula+minúscula, número, especial).
  const points = [longEnough, hasLower && hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  const score = password === '' ? 0 : Math.max(points, 1);

  return { rules, score, valid: rules.length && rules.mixedCase && rules.numberAndSpecial };
}
