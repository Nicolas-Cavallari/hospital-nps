import * as sectorsService from '../services/sectors.service.js';

export async function list(req, res) {
  res.json({ sectors: await sectorsService.listSectors(req.user) });
}

export async function get(req, res) {
  res.json({ sector: await sectorsService.getSector(req.user, req.params.id) });
}
