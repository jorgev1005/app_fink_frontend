import { Router } from 'express';
import { 
  recalculateBalancesEndpoint, 
  restartApp, 
  getAllUsersWithProjects, 
  createOrInviteUser, 
  setUserProjectAssignments 
} from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Only authenticated + authorized (ADMIN)
router.use(authenticate);

router.post('/recalculate-balances', authorize('ADMIN'), recalculateBalancesEndpoint);
router.post('/restart', authorize('ADMIN'), restartApp);

// Gestión de usuarios y asignación de proyectos
router.get('/users', authorize('ADMIN'), getAllUsersWithProjects);
router.post('/users', authorize('ADMIN'), createOrInviteUser);
router.put('/users/:userId/projects', authorize('ADMIN'), setUserProjectAssignments);

export default router;
