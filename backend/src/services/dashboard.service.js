import * as dashboardRepository from '../repositories/dashboard.repository.js';
import { sectorScope } from '../config/permissions.js';
import { forbidden, HttpError } from '../utils/http-error.js';

export async function getDashboard(user, { month, sectorId, shiftId, teamId } = {}) {
  const scope = sectorScope(user, { allPermission: 'results:read:all', ownPermission: 'results:read:own' });
  if (!scope) throw forbidden();
  const ownSector = scope.all ? null : scope.sectorId;
  if (ownSector && sectorId && sectorId !== ownSector) throw forbidden();
  let snapshot;
  try {
    snapshot = await dashboardRepository.latest();
    if (!snapshot) snapshot = await dashboardRepository.refresh();
  } catch (error) {
    if (error.code === '42P01') {
      throw new HttpError(503, 'Dashboard ainda não foi inicializado. Aplique as migrações do backend e reinicie o servidor.', { code: 'DASHBOARD_NOT_READY' });
    }
    throw error;
  }
  const scopedRows = snapshot.rows.filter((row) => !ownSector || row.sectorId === ownSector);
  const baseFilteredRows = scopedRows.filter((row) =>
    (!sectorId || row.sectorId === sectorId) &&
    (!shiftId || row.shiftId === shiftId) &&
    (!teamId || row.teamId === teamId),
  );
  const rows = baseFilteredRows.filter((row) => !month || row.month === month);
  return {
    refreshedAt: snapshot.refreshed_at,
    rows,
    trendRows: baseFilteredRows,
    scopeSectorId: ownSector,
    availableMonths: [...new Set(scopedRows.map((row) => row.month))].sort().reverse(),
    sectors: [...new Map(scopedRows.map((row) => [row.sectorId, { id: row.sectorId, name: row.sector }])).values()]
      .sort((a, b) => a.name.localeCompare(b.name)),
    shifts: [...new Map(scopedRows.filter((row) => row.shiftId).map((row) => [row.shiftId, { id: row.shiftId, name: row.shift }])).values()]
      .sort((a, b) => a.name.localeCompare(b.name)),
    teams: [...new Map(scopedRows.filter((row) => row.teamId).map((row) => [row.teamId, { id: row.teamId, name: row.team }])).values()]
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
