// Impede que os testes de acesso "passem em silêncio" quando não há banco de teste configurado.
if (!process.env.TEST_DATABASE_URL?.trim()) {
  console.error(
    'Defina TEST_DATABASE_URL com a URL de um banco de TESTE (com as migrações aplicadas).\n' +
      'Os testes criam e removem usuários/setores de teste; prefira um banco separado do real.',
  );
  process.exit(1);
}
