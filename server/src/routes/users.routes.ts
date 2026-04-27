import { Router } from 'express';
import { validateToken } from '../middleware/auth.middleware';
import * as usersController from '../controllers/users.controller';

const router = Router();

router.get('/me', validateToken, (req, res) => {
  usersController.getMe(req, res);
});

export default router;
