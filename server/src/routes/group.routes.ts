import { Router } from 'express';
import { validateToken } from '../middleware/auth.middleware';
import * as groupController from '../controllers/group.controller';

const router = Router();

router.use(validateToken);

router.post('/', (req, res, next) => {
  void groupController.createGroupHandler(req, res).catch(next);
});

router.get('/', (req, res, next) => {
  void groupController.getMyGroupsHandler(req, res).catch(next);
});

router.get('/:id', (req, res, next) => {
  void groupController.getGroupByIdHandler(req, res).catch(next);
});

router.post('/join', (req, res, next) => {
  void groupController.joinGroupHandler(req, res).catch(next);
});

router.delete('/:id', (req, res, next) => {
  void groupController.deleteGroupHandler(req, res).catch(next);
});

export default router;
