import { Router } from 'express';
import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';

const router = Router();

// Verificação de funcionamento (sem dados sensíveis).
router.use('/health', healthRoutes);

// Login, sessão e troca de senha.
router.use('/auth', authRoutes);

// Área privada: autenticação + autorização verificadas no backend em toda operação.
router.use('/admin', adminRoutes);

// Reservado para a próxima etapa (ver "Mapa de URLs" no README):
//   /api/public/*  -> pesquisa pública (sem login); só as operações necessárias para responder.

export default router;
