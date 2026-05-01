import { Router } from 'express';
import { getDashboardData, getProjectDashboard } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Dashboard general (todos los proyectos)
router.get('/', getDashboardData);

// Dashboard de un proyecto específico
router.get('/project/:id', getProjectDashboard);

export default router;
