import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkSyncCosts,
} from '../controllers/product.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getProducts);
router.get('/:id', getProductById);
router.post('/', createProduct);
router.post('/bulk-sync-costs', bulkSyncCosts);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;
