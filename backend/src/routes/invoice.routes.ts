import { Router } from 'express';
import { 
  createInvoice, 
  getInvoices, 
  postInvoice, 
  deleteInvoice, 
  getInvoiceById, 
  updateInvoice, 
  getInvoicePdf, 
  getNextInvoiceCodeEndpoint,
  issueInvoiceFromDeliveryNote,
  convertPurchaseOrderToBill,
  updateDispatchStatus,
  createInvoiceReturn
} from '../controllers/invoice.controller';
import { payInvoice } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Endpoint público para descargar / visualizar PDF vectorial (OC, NE, etc.)
router.get('/:id/pdf', getInvoicePdf);

router.use(authenticate);

router.get('/next-code', getNextInvoiceCodeEndpoint);
router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.put('/:id', updateInvoice);
router.patch('/:id/dispatch-status', updateDispatchStatus);
router.post('/:id/issue-invoice', issueInvoiceFromDeliveryNote);
router.post('/:id/convert-po-to-bill', convertPurchaseOrderToBill);
router.post('/:id/returns', createInvoiceReturn);
router.post('/:id/post', postInvoice);
router.post('/:id/pay', payInvoice);
router.delete('/:id', deleteInvoice);
router.post('/', createInvoice);

export default router;
