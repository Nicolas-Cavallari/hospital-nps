import { closePool, isDatabaseConfigured } from '../config/db.js';
import { ROLES } from '../config/permissions.js';
import { createUser, findSectorIdBySlug } from '../services/users.service.js';
import { createUserSchema } from '../validators/users.validator.js';

/**
 * Cria um usuário interno com senha temporária aleatória (mostrada uma única vez).
 * É a forma de criar o PRIMEIRO Super Admin; os demais usuários são criados por ele pela API.
 *
 *   npm run user:create -- --username=admin --name="Nome Completo"
 *   npm run user:create -- --username=ana.gestora --name="Ana" --role=gestor --sector=recepcao
 *   npm run user:create -- --username=ouv.joao --name="João" --role=ouvidoria
 */
function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const match = /^--([a-z]+)=(.*)$/.exec(arg);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function fail(message) {
  console.error(`Erro: ${message}`);
  process.exitCode = 1;
}

async function main() {
  if (!isDatabaseConfigured()) return fail('DATABASE_URL não está configurada no arquivo backend/.env.');

  const args = parseArgs(process.argv.slice(2));
  const role = args.role ?? ROLES.SUPER_ADMIN;

  let sectorId;
  if (args.sector) {
    sectorId = await findSectorIdBySlug(args.sector);
    if (!sectorId) return fail(`Setor com slug "${args.sector}" não encontrado.`);
  }

  const parsed = createUserSchema.safeParse({ username: args.username, fullName: args.name, role, sectorId });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => `${i.path.join('.') || 'dados'}: ${i.message}`).join(' | '));
  }

  try {
    const { user, temporaryPassword } = await createUser(parsed.data);
    console.log(`Usuário criado: ${user.username} (${user.role})`);
    console.log(`Senha temporária: ${temporaryPassword}`);
    console.log('Anote agora: ela não será mostrada novamente e deve ser trocada no primeiro acesso.');
  } catch (err) {
    fail(err.status ? err.message : 'não foi possível criar o usuário.');
  }
  return undefined;
}

try {
  await main();
} finally {
  await closePool();
}
