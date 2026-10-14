import { closePool } from '../config/db.js';
import { pingDatabase } from '../repositories/health.repository.js';

const result = await pingDatabase();
await closePool();

if (result.ok) {
  console.log('Banco de dados: OK (conexão e consulta SELECT 1 funcionaram).');
  process.exit(0);
}

if (result.reason === 'not_configured') {
  console.error('Banco de dados: DATABASE_URL não está configurada no arquivo backend/.env.');
} else {
  console.error('Banco de dados: não foi possível conectar. Confira a string de conexão, a senha e o SSL.');
}
process.exit(1);
