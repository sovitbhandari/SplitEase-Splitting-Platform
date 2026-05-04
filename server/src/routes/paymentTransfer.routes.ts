import { Router } from 'express';
import { validateToken } from '../middleware/auth.middleware';
import * as paymentTransferController from '../controllers/paymentTransfer.controller';

const router = Router();

router.use(validateToken);

router.get('/:groupId/payment-methods', (req, res, next) => {
  void paymentTransferController.getPaymentMethodsHandler(req, res).catch(next);
});

router.get('/:groupId/transfers', (req, res, next) => {
  void paymentTransferController.listGroupTransfersHandler(req, res).catch(next);
});

router.post('/:groupId/settlements/:settlementId/transfer/preview', (req, res, next) => {
  void paymentTransferController.previewTransferHandler(req, res).catch(next);
});

router.post('/:groupId/settlements/:settlementId/transfer/create', (req, res, next) => {
  void paymentTransferController.createTransferHandler(req, res).catch(next);
});

export default router;
