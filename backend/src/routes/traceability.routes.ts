import { Router } from 'express';
import { getTraceability } from '../controllers/traceability.controller';

const router = Router();

// Endpoint de trazabilidad de documentos por código o id
// e.g. /api/traceability/COT-2026-001 o /api/traceability/NE-0001
router.get('/:codeOrId', getTraceability);

export default router;
