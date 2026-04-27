import { Router } from 'express';
import * as authController from '../controllers/auth.controller';

const router = Router();

router.post('/register', (req, res, next) => {
  void authController.register(req, res).catch(next);
});
router.post('/login', (req, res, next) => {
  void authController.login(req, res).catch(next);
});
router.post('/refresh', (req, res, next) => {
  void authController.refresh(req, res).catch(next);
});
router.post('/logout', (req, res, next) => {
  void authController.logout(req, res).catch(next);
});

export default router;
