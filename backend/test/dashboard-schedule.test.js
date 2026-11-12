import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';

process.env.DATABASE_URL = 'postgres://unused-for-mocked-tests';
const { setPoolForTesting } = await import('../src/config/db.js');
const { getDashboard } = await import('../src/services/dashboard.service.js');
const { startDashboardSnapshotJob, stopDashboardSnapshotJob, DASHBOARD_REFRESH_MS } =
  await import('../src/jobs/dashboard-snapshot.job.js');

test('snapshot atualiza ao iniciar e agenda a cada oito horas, sem duplicar o job', async (t) => {
  let refreshes = 0;
  let callback;
  let cleared;
  const timer = { unref() {} };
  setPoolForTesting({ query: async () => {
    refreshes++;
    return { rows: [{ rows: [] }] };
  } });
  t.mock.method(globalThis, 'setInterval', (fn, delay) => {
    assert.equal(delay, 8 * 60 * 60 * 1000);
    assert.equal(delay, DASHBOARD_REFRESH_MS);
    callback = fn;
    return timer;
  });
  t.mock.method(globalThis, 'clearInterval', (value) => { cleared = value; });
  try {
    startDashboardSnapshotJob();
    startDashboardSnapshotJob();
    await setImmediate();
    assert.equal(refreshes, 2); // leitura e gravação de um snapshot
    assert.equal(globalThis.setInterval.mock.callCount(), 1);
    await callback();
    assert.equal(refreshes, 4);
    stopDashboardSnapshotJob();
    assert.equal(cleared, timer);
  } finally {
    stopDashboardSnapshotJob();
    setPoolForTesting(null);
  }
});

test('gestor recebe somente dados e opções de filtro do próprio setor', async () => {
  const rows = ['a', 'b'].map((sectorId) => ({
    sectorId, sector: sectorId, month: '2026-11',
    shiftId: `shift-${sectorId}`, shift: sectorId,
    teamId: `team-${sectorId}`, team: sectorId,
  }));
  setPoolForTesting({ query: async () => ({ rows: [{ refreshed_at: new Date(), rows }] }) });
  try {
    const result = await getDashboard({ role: 'gestor', sectorId: 'a' });
    assert.deepEqual(result.rows, [rows[0]]);
    assert.deepEqual(result.trendRows, [rows[0]]);
    assert.deepEqual(result.sectors, [{ id: 'a', name: 'a' }]);
    assert.deepEqual(result.shifts, [{ id: 'shift-a', name: 'a' }]);
    assert.deepEqual(result.teams, [{ id: 'team-a', name: 'a' }]);
  } finally {
    setPoolForTesting(null);
  }
});
