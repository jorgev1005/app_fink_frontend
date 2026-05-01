import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import settingsController from '../controllers/settings.controller';

const router = Router();

// GET /api/settings/parse-threshold?projectId=...
router.get('/parse-threshold', authenticate, settingsController.getParseThreshold);

// POST /api/settings/parse-threshold  { projectId?, threshold, scope }
router.post('/parse-threshold', authenticate, settingsController.saveParseThreshold);

export default router;
