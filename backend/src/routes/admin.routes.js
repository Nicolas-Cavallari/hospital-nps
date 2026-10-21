import { Router } from 'express';
import * as sectors from '../controllers/sectors.controller.js';
import * as users from '../controllers/users.controller.js';
import { authenticate, requirePasswordChanged } from '../middlewares/authenticate.js';
import { requirePermission } from '../middlewares/authorize.js';
import { requireCsrfHeader } from '../middlewares/csrf.js';

const router = Router();

// NEGADO POR PADRÃO: tudo que existir (ou vier a existir) sob /api/admin exige sessão válida,
// senha já trocada e o cabeçalho anti-CSRF nas operações que alteram dados.
router.use(requireCsrfHeader);
router.use(authenticate);
router.use(requirePasswordChanged);

// Usuários internos: somente Super Admin.
const usersRouter = Router();
usersRouter.get('/', users.list);
usersRouter.post('/', users.create);
usersRouter.get('/:id', users.get);
usersRouter.patch('/:id', users.update);
usersRouter.post('/:id/reset-password', users.resetPassword);
router.use('/users', requirePermission('users:manage'), usersRouter);

// Setores (somente leitura nesta etapa): Super Admin e ouvidoria veem todos; o gestor, só o seu.
const sectorsRouter = Router();
sectorsRouter.get('/', sectors.list);
sectorsRouter.get('/:id', sectors.get);
router.use('/sectors', requirePermission('sectors:read:all', 'sectors:read:own'), sectorsRouter);

// Ouvidoria: o acesso já está protegido (Super Admin e ouvidoria); os endpoints vêm em etapa futura.
router.use('/ouvidoria', requirePermission('ouvidoria:read'), Router());

export default router;
