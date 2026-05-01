import { Router } from 'express';
import { getInsights, analyzeDocument, generateReport } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Obtener insights de IA
router.get('/insights', getInsights);

// Analizar documento con IA
router.post('/analyze-document', analyzeDocument);

// Generar informe ejecutivo
router.post('/generate-report', generateReport);

export default router;
