// A tela de agradecimento só pode ser aberta depois da confirmação do servidor.
export async function continueNps(score, { finish, advance }) {
  if (!Number.isInteger(score) || score < 0 || score > 10) return;
  if (score > 6) return finish(null);
  return advance('nps');
}
