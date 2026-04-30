import { Router } from 'express';
import { validateToken } from '../middleware/auth.middleware';
import * as plaidController from '../controllers/plaid.controller';

const router = Router();

router.use(validateToken);

router.get('/link-token', (req, res, next) => {
  void plaidController.getLinkToken(req, res).catch(next);
});

router.post('/exchange', (req, res, next) => {
  void plaidController.exchangeToken(req, res).catch(next);
});

router.get('/accounts', (req, res, next) => {
  void plaidController.getMyAccounts(req, res).catch(next);
});

export default router;
