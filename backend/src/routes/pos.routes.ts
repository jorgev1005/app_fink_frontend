import { Router } from 'express';
import {
  getActiveSession,
  openSession,
  closeSession,
  getSessionSummary,
  processPOSSale,
  voidPOSSale,
  exportQuotationPDF
} from '../controllers/pos.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/session/active', getActiveSession);
router.post('/session/open', openSession);
router.post('/session/close', closeSession);
router.get('/session/summary', getSessionSummary);

router.post('/sale', processPOSSale);
router.post('/sale/:id/void', voidPOSSale);
router.post('/quotation-pdf', exportQuotationPDF);

export default router;
