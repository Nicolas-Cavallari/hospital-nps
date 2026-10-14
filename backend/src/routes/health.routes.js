import { Router } from 'express';
import { apiHealth, databaseHealth } from '../controllers/health.controller.js';

const router = Router();

router.get('/', apiHealth);
router.get('/db', databaseHealth);

export default router;
