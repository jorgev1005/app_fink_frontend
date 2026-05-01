import { Router } from 'express';
import { getLatestRates, getRateHistory, createCustomRate, updateRates, getLatestRatesBySource, updateAllRates } from '../controllers/exchangeRate.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Obtener tasas actuales
router.get('/latest', getLatestRates);

// Obtener historial de tasas
router.get('/history', getRateHistory);

// Crear tasa personalizada
router.post('/custom', createCustomRate);

// Endpoint para forzar actualización desde una fuente (usa query/body { source: 'BINANCE'|'BCV'|'CUSTOM' })
router.post('/update', authorize('ADMIN'), updateRates);

// Shortcut para actualizar específicamente desde Binance
router.post('/update-binance', authorize('ADMIN'), (req, res, next) => {
	// attach source and forward to controller
	req.query = { ...(req.query || {}), source: 'BINANCE' } as any;
	return updateRates(req, res as any);
});

// Endpoint para actualizar todas las fuentes (BCV + BINANCE + ensure CUSTOM)
router.post('/update-all', authorize('ADMIN'), updateAllRates);

// Obtener tasas más recientes por fuente (BCV, BINANCE, CUSTOM)
router.get('/latest-by-source', getLatestRatesBySource);

export default router;
