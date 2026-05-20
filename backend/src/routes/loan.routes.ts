import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createLoan,
  getLoans,
  getLoanById,
  deleteLoanEndpoint,
  addLoanPayment,
  addLoanCharge
} from '../controllers/loan.controller';

const router = Router();

// Todas las rutas requieren estar autenticado
router.use(authenticate);

// CRUD básico
router.get('/', getLoans);
router.post('/', createLoan);
router.get('/:id', getLoanById);
router.delete('/:id', deleteLoanEndpoint);

// Acciones financieras
router.post('/:id/payment', addLoanPayment);
router.post('/:id/charge', addLoanCharge);

export default router;