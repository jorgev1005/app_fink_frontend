import { Router } from 'express';
import { createInvoice, getInvoices, postInvoice, deleteInvoice, getInvoiceById, updateInvoice } from '../controllers/invoice.controller';
import { payInvoice } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.put('/:id', updateInvoice);
router.post('/:id/post', postInvoice);
router.post('/:id/pay', payInvoice);
router.delete('/:id', deleteInvoice);
router.post('/', createInvoice);

export default router;
