import { Router } from 'express';
import { getNotifications, markAllAsRead, markAsRead } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Obtener notificaciones del usuario
router.get('/', getNotifications);

// Marcar todas como leidas
router.put('/read-all', markAllAsRead);

// Marcar como leída
router.put('/:id/read', markAsRead);

export default router;
