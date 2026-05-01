import { Router } from 'express';
import { recalculateBalancesEndpoint, restartApp } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Only authenticated + authorized (ADMIN)
router.use(authenticate);

router.post('/recalculate-balances', authorize('ADMIN'), recalculateBalancesEndpoint);
router.post('/restart', authorize('ADMIN'), restartApp);

export default router;
