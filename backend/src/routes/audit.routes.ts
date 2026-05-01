import { Router } from 'express';
import { getAccountAuditLog } from '../controllers/audit.controller';

const router = Router();

// GET /api/audit/account-log?projectId=&accountId=&startDate=&endDate=&adminKey=
router.get('/audit/account-log', getAccountAuditLog);

export default router;
