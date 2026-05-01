import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getContactReports, getContactAgingReport } from '../controllers/report.controller';
import { 
  getAnalyticsSummary, 
  getAnalyticsTrend, 
  getAnalyticsCategories, 
  getAnalyticsPaymentMethods,
  getCashFlowForecast,
  getProductStats
} from '../controllers/reports.controller';
import { getForexImpact } from '../controllers/forex.controller';

const router = Router();

router.use(authenticate);

// Visual Analytics Reports
router.get('/summary', getAnalyticsSummary);
router.get('/trend', getAnalyticsTrend);
router.get('/categories', getAnalyticsCategories);
router.get('/payment-methods', getAnalyticsPaymentMethods);
router.get('/cash-flow', getCashFlowForecast);
router.get('/products', getProductStats);
router.get('/forex-impact', getForexImpact);


// Contact Reports
router.get('/contacts', getContactReports);
router.get('/aging', getContactAgingReport);

export default router;
