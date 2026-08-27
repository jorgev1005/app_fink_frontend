import { Router } from 'express';
import {
  getQuotations,
  getQuotationById,
  updateQuotationStatus,
  generatePOFromQuotation,
  viewQuotationPDF
} from '../controllers/quotation.controller';

const router = Router();

// Rutas de consulta y operativas
router.get('/', getQuotations);
router.get('/:id', getQuotationById);
router.get('/:id/pdf', viewQuotationPDF);
router.patch('/:id/status', updateQuotationStatus);
router.post('/:id/generate-po', generatePOFromQuotation);

export default router;
