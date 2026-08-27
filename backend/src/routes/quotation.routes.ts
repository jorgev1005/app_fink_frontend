import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getQuotations,
  getQuotationById,
  updateQuotationStatus,
  generatePOFromQuotation,
  viewQuotationPDF
} from '../controllers/quotation.controller';

const router = Router();

// Rutas autenticadas y de consulta
router.get('/', authenticate, getQuotations);
router.get('/:id', authenticate, getQuotationById);
router.get('/:id/pdf', viewQuotationPDF);
router.patch('/:id/status', authenticate, updateQuotationStatus);
router.post('/:id/generate-po', authenticate, generatePOFromQuotation);

export default router;
