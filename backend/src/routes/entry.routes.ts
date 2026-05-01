import { Router } from 'express';
import { createEntry } from '../controllers/entry.controller';
import { parseEntryText } from '../controllers/parse.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/create', createEntry);
router.post('/parse', parseEntryText);

export default router;
