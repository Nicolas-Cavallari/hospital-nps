/**
 * "Pool" de teste que usa UMA conexão já dentro de uma transação. Cada comando vira um savepoint
 * (um erro de banco não aborta o resto), e BEGIN/COMMIT/ROLLBACK da aplicação viram savepoints
 * também. No fim, a transação externa é desfeita: nada do que os testes fizeram permanece no
 * banco, então é seguro rodar contra o banco real. Use somente requisições em sequência.
 */
export function createSandboxPool(client) {
  const open = [];
  let counter = 0;
  let chain = Promise.resolve();

  // Uma só conexão: comandos disparados "ao mesmo tempo" (Promise.all) rodam um por vez.
  function query(text, params) {
    const run = chain.then(() => execute(text, params));
    chain = run.catch(() => {});
    return run;
  }

  async function execute(text, params) {
    const sql = typeof text === 'string' ? text.trim().toLowerCase() : null;

    if (sql === 'begin') {
      const name = `app_tx_${(counter += 1)}`;
      open.push(name);
      return client.query(`savepoint ${name}`);
    }
    if (sql === 'commit') return client.query(`release savepoint ${open.pop()}`);
    if (sql === 'rollback') {
      const name = open.pop();
      await client.query(`rollback to savepoint ${name}`);
      return client.query(`release savepoint ${name}`);
    }
    if (open.length > 0) return client.query(text, params); // o rollback do serviço recupera

    const name = `app_stmt_${(counter += 1)}`;
    await client.query(`savepoint ${name}`);
    try {
      const result = await client.query(text, params);
      await client.query(`release savepoint ${name}`);
      return result;
    } catch (err) {
      await client.query(`rollback to savepoint ${name}`);
      await client.query(`release savepoint ${name}`);
      throw err;
    }
  }

  return {
    query,
    connect: async () => ({ query, release() {} }),
    on() {},
    async end() {},
  };
}
