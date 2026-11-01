/**
 * Regras de apresentação das alternativas (só visual; os valores gravados não mudam):
 *  - a melhor alternativa vem primeiro, à esquerda, e a pior por último, à direita;
 *  - a escala padrão de 1 a 5 usa emojis; qualquer outra usa números.
 */
export function sortForDisplay(options) {
  return [...options].sort((a, b) => b.value - a.value);
}

/** Emojis só para a escala padrão: exatamente as alternativas 1, 2, 3, 4 e 5. */
export function usesEmojis(options) {
  const values = options.map((option) => option.value);
  return values.length === 5 && [1, 2, 3, 4, 5].every((value) => values.includes(value));
}
