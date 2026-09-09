import { Router } from 'express';
import { createPayment, getPayments, importBankItems, revertPayment } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getPayments);
router.post('/', createPayment);
router.post('/import', importBankItems);
router.delete('/:id', revertPayment);

export default router;
