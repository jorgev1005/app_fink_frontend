import { Router } from 'express';
import { getCFOSummary, getDetailedCFOReport } from '../controllers/cfo.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/summary', getCFOSummary);
router.get('/report', getDetailedCFOReport);

export default router;
