import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getTransactionCategoriesNormalized,
  createTransactionCategory,
  updateTransactionCategory,
  deleteTransactionCategory,
} from '../controllers/transactionCategory.controller';

const router = Router();

router.use(authenticate);

// Listar todas las categorías normalizadas (opcionalmente por proyectoId)
router.get('/', getTransactionCategoriesNormalized);

// CRUD de categorías
router.post('/', createTransactionCategory);
router.put('/:id', updateTransactionCategory);
router.delete('/:id', deleteTransactionCategory);

export default router;
