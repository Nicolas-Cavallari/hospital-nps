import { Router } from 'express';
import * as sectors from '../controllers/sectors.controller.js';
import * as settings from '../controllers/settings.controller.js';
import * as users from '../controllers/users.controller.js';
import * as dashboard from '../controllers/dashboard.controller.js';
import * as ombudsman from '../controllers/ombudsman.controller.js';
import { authenticate, requirePasswordChanged } from '../middlewares/authenticate.js';
import { requirePermission } from '../middlewares/authorize.js';
import { requireCsrfHeader } from '../middlewares/csrf.js';

const router = Router();

// NEGADO POR PADRÃO: tudo que existir (ou vier a existir) sob /api/admin exige sessão válida,
// senha já trocada e o cabeçalho anti-CSRF nas operações que alteram dados.
router.use(requireCsrfHeader);
router.use(authenticate);
router.use(requirePasswordChanged);

// Indicadores agregados; gestores recebem exclusivamente as linhas do próprio setor.
router.get('/dashboard', requirePermission('results:read:all', 'results:read:own'), dashboard.get);

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

// Configurações gerais (link do texto legal): somente Super Admin.
const settingsRouter = Router();
settingsRouter.get('/', settings.get);
settingsRouter.put('/privacy-policy-url', settings.setPrivacyPolicyUrl);
router.use('/settings', requirePermission('settings:manage'), settingsRouter);

// Consulta: Super Admin e ouvidoria. Registro do atendimento: somente ouvidoria.
const ombudsmanRouter = Router();
ombudsmanRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
ombudsmanRouter.get('/', ombudsman.list);
ombudsmanRouter.get('/:id', ombudsman.get);
ombudsmanRouter.post('/:id/attempts', requirePermission('ouvidoria:handle'), ombudsman.attempt);
ombudsmanRouter.post('/:id/actions', requirePermission('ouvidoria:handle'), ombudsman.action);
ombudsmanRouter.post('/:id/close', requirePermission('ouvidoria:handle'), ombudsman.close);
router.use('/ouvidoria', requirePermission('ouvidoria:read'), ombudsmanRouter);

export default router;
