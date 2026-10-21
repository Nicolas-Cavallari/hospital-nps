/**
 * Perfis e permissões do sistema (fonte única). Baseado no relatório de requisitos:
 *  - Super Admin: acesso geral e administração;
 *  - Gestor: apenas o setor ao qual está vinculado;
 *  - Ouvidoria: atendimento dos feedbacks e consulta; sem funções administrativas;
 *  - Respondente público: sem conta; usa apenas as rotas públicas da pesquisa.
 *
 * As rotas verificam PERMISSÕES, não perfis, para que novas funcionalidades herdem a mesma regra.
 * O sufixo ":own" vale só para o setor do gestor; ":all" vale para todos os setores.
 */
export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  GESTOR: 'gestor',
  OUVIDORIA: 'ouvidoria',
});

const { SUPER_ADMIN, GESTOR, OUVIDORIA } = ROLES;

export const PERMISSIONS = Object.freeze({
  // Administração do sistema (somente Super Admin)
  'users:manage': [SUPER_ADMIN],
  'settings:manage': [SUPER_ADMIN],
  'teams-shifts:manage': [SUPER_ADMIN],
  'nps-question:manage': [SUPER_ADMIN],

  // Setores, perguntas e resultados
  'sectors:read:all': [SUPER_ADMIN, OUVIDORIA],
  'sectors:read:own': [GESTOR],
  'questions:manage:all': [SUPER_ADMIN],
  'questions:manage:own': [GESTOR],
  'results:read:all': [SUPER_ADMIN, OUVIDORIA],
  'results:read:own': [GESTOR],

  // Ouvidoria: o Super Admin acompanha; só a ouvidoria registra o atendimento
  'ouvidoria:read': [SUPER_ADMIN, OUVIDORIA],
  'ouvidoria:handle': [OUVIDORIA],
});

export function hasPermission(user, permission) {
  return Boolean(user) && (PERMISSIONS[permission] ?? []).includes(user.role);
}

/**
 * Define o alcance de um usuário sobre um recurso por setor:
 *  - { all: true }                    -> todos os setores;
 *  - { all: false, sectorId }         -> apenas o setor do gestor;
 *  - null                             -> sem acesso.
 */
export function sectorScope(user, { allPermission, ownPermission }) {
  if (hasPermission(user, allPermission)) return { all: true };
  if (hasPermission(user, ownPermission) && user.sectorId) return { all: false, sectorId: user.sectorId };
  return null;
}
