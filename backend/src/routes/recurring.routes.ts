import { Router } from 'express';
import { triggerRecurring, getRecurringRules, markOccurrencePaid, getPendingOccurrences, batchMarkPaidOccurrences, getOccurrence, updateOccurrence, cancelOccurrence, createRecurringRule, deleteRecurringRule, getBatches, getBatchById } from '../controllers/recurring.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getRecurringRules);
router.post('/', createRecurringRule);
router.delete('/:id', deleteRecurringRule);
router.post('/:id/trigger', triggerRecurring);
router.post('/occurrence/:id/mark-paid', markOccurrencePaid);
router.get('/occurrence/:id', getOccurrence);
router.put('/occurrence/:id', authorize('ADMIN'), updateOccurrence);
router.post('/occurrence/:id/cancel', authorize('ADMIN'), cancelOccurrence);
router.get('/occurrences/pending', getPendingOccurrences);
router.get('/occurrences/batches', authorize('ADMIN'), getBatches);
router.get('/occurrences/batches/:id', authorize('ADMIN'), getBatchById);
router.post('/occurrences/mark-paid-batch', authorize('ADMIN'), batchMarkPaidOccurrences);

export default router;
