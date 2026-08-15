import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkSyncCosts,
  transferProductStock,
  exportPriceListPDF,
} from '../controllers/product.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/export/price-list-pdf', exportPriceListPDF);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.post('/', createProduct);
router.post('/bulk-sync-costs', bulkSyncCosts);
router.post('/transfer', transferProductStock);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;

