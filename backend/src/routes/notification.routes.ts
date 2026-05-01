import { Router } from 'express';
import { getNotifications, markAsRead } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Obtener notificaciones del usuario
router.get('/', getNotifications);

// Marcar como leída
router.put('/:id/read', markAsRead);

export default router;
