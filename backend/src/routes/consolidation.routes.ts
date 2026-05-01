import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listConsolidationGroups,
  createConsolidationGroup,
  getConsolidationGroup,
  updateConsolidationGroup,
  replaceGroupAccounts,
  deleteConsolidationGroup
} from '../controllers/consolidation.controller';

const router = Router();

router.use(authenticate);

// List groups for current user
router.get('/', listConsolidationGroups);

// Create group
router.post('/', createConsolidationGroup);

// Get group
router.get('/:id', getConsolidationGroup);

// Preview / export-friendly data for a group
// Preview / export-friendly data for a group
import { previewConsolidationGroup } from '../controllers/consolidation.controller';
router.get('/:id/preview', previewConsolidationGroup);

// Update group metadata
router.put('/:id', updateConsolidationGroup);

// Replace accounts
router.put('/:id/accounts', replaceGroupAccounts);

// Delete group
router.delete('/:id', deleteConsolidationGroup);

export default router;
