import { Router } from 'express';
import * as publicController from '../controllers/public.controller.js';

/**
 * Rotas PÚBLICAS: somente o necessário para responder à pesquisa. Não usam login nem cookie.
 * O respondente alcança apenas a própria avaliação, com o token que recebeu ao iniciá-la.
 * Não existe nenhuma rota que liste ou consulte avaliações, respostas ou indicadores.
 */
const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/surveys/:slug', publicController.getSurvey);
router.post('/surveys/:slug/evaluations', publicController.createEvaluation);
router.put('/evaluations/:id/visit', publicController.updateVisit);
router.put('/evaluations/:id/answers/:questionId', publicController.saveAnswer);
router.post('/evaluations/:id/finish', publicController.finish);

export default router;
