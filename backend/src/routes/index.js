import { Router } from 'express';
import healthRoutes from './health.routes.js';

const router = Router();

// Verificação de funcionamento (sem dados sensíveis).
router.use('/health', healthRoutes);

// Reservados para as próximas etapas (ver "Mapa de URLs" no README):
//   /api/auth/*    -> login e sessão
//   /api/public/*  -> pesquisa pública (sem login)
//   /api/admin/*   -> área privada (autenticação + autorização)

export default router;
