import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getAccounts,
  getAccountById,
  createAccount,
  adjustAccount,
  updateAccount,
  deleteAccount,
  getAccountBalance,
  getAccountLedger,
} from '../controllers/account.controller';

const router = Router();

router.use(authenticate);

// CRUD de cuentas
router.get('/', getAccounts);
router.get('/:id', getAccountById);
router.post('/', createAccount);
router.post('/:id/adjust', adjustAccount);
router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);

// Consultas especiales
router.get('/:id/balance', getAccountBalance);
router.get('/:id/ledger', getAccountLedger);

export default router;
