import { Router } from 'express';
import { getBackupConfig, updateBackupConfig, triggerManualBackup, getBackupsList, restoreBackup } from '../controllers/backup.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Only ADMIN should configure backups
router.get('/config', authenticate, authorize('ADMIN'), getBackupConfig);
router.put('/config', authenticate, authorize('ADMIN'), updateBackupConfig);
router.post('/trigger', authenticate, authorize('ADMIN'), triggerManualBackup);

// List and restore
router.get('/list', authenticate, authorize('ADMIN'), getBackupsList);
router.post('/restore', authenticate, authorize('ADMIN'), restoreBackup);

export default router;
