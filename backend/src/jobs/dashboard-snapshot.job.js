import * as dashboardRepository from '../repositories/dashboard.repository.js';

export const DASHBOARD_REFRESH_MS = 8 * 60 * 60 * 1000;
let timer;

export function startDashboardSnapshotJob() {
  if (timer) return;
  const refresh = () => dashboardRepository.refresh().catch((error) => {
    console.error('[dashboard] falha ao atualizar snapshot:', error.message);
  });
  void refresh();
  timer = setInterval(refresh, DASHBOARD_REFRESH_MS);
  timer.unref?.();
}

export function stopDashboardSnapshotJob() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
