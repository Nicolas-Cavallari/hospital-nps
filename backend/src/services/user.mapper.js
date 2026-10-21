/** Formato devolvido pela API: nunca inclui o hash da senha nem a versão da sessão. */
export function toPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    sectorId: row.sector_id,
    mustChangePassword: row.must_change_password,
    isActive: row.is_active,
  };
}

export const toAdminUser = (row) => ({ ...toPublicUser(row), createdAt: row.created_at });

export const toSector = (row) => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  isActive: row.is_active,
});
