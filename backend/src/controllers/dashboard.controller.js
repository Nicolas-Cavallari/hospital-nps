import * as dashboardService from '../services/dashboard.service.js';

export async function get(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.json(await dashboardService.getDashboard(req.user, {
    month: req.query.month,
    sectorId: req.query.sectorId,
    shiftId: req.query.shiftId,
    teamId: req.query.teamId,
  }));
}
