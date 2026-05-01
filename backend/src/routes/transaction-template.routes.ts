import { Router } from 'express';
import * as controller from '../controllers/transaction-template.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/', controller.createTemplate);
router.get('/', controller.getTemplates);
router.delete('/:id', controller.deleteTemplate);

export default router;
