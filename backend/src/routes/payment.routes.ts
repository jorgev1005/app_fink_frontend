import { Router } from 'express';
import { createPayment, getPayments, importBankItems } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getPayments);
router.post('/', createPayment);
router.post('/import', importBankItems);

export default router;
