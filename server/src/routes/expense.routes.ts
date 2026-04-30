import { Router } from 'express';
import { validateToken } from '../middleware/auth.middleware';
import * as expenseController from '../controllers/expense.controller';

const router = Router();

router.use(validateToken);

router.post('/:groupId/expenses', (req, res, next) => {
  void expenseController.createExpenseHandler(req, res).catch(next);
});

router.get('/:groupId/expenses', (req, res, next) => {
  void expenseController.getGroupExpensesHandler(req, res).catch(next);
});

router.delete('/:groupId/expenses/:expenseId', (req, res, next) => {
  void expenseController.deleteExpenseHandler(req, res).catch(next);
});

export default router;
