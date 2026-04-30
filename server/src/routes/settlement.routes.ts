import { Router } from 'express';
import { validateToken } from '../middleware/auth.middleware';
import * as settlementController from '../controllers/settlement.controller';

const router = Router();

router.use(validateToken);

router.get('/:groupId/settlements', (req, res, next) => {
  void settlementController.getGroupDebtsHandler(req, res).catch(next);
});

router.post('/:groupId/settlements', (req, res, next) => {
  void settlementController.settleDebtHandler(req, res).catch(next);
});

export default router;
