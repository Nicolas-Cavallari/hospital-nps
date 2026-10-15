/** Apoio à digitação do celular (somente formatação e checagem de formato na tela). */

export function onlyDigits(value) {
  return value.replace(/\D/g, '').slice(0, 11);
}

export function formatPhone(digits) {
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Celular brasileiro: DDD (2 dígitos) + 9 + 8 dígitos. */
export function isValidMobile(digits) {
  return /^[1-9]{2}9\d{8}$/.test(digits);
}
