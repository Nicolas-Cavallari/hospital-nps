import { Router } from 'express';
import { changePassword, login, logout, me } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requireCsrfHeader } from '../middlewares/csrf.js';

const router = Router();

router.use(requireCsrfHeader);

router.post('/login', login); // público: é por onde a sessão nasce
router.post('/logout', logout); // idempotente: apenas apaga o cookie
router.get('/me', authenticate, me); // permitido mesmo com troca de senha pendente
router.post('/change-password', authenticate, changePassword); // idem

export default router;
