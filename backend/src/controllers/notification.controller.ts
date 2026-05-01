import { Request, Response } from 'express';
import prisma from '../config/database';

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { unreadOnly = 'false' } = req.query;

    const where: any = {
      userId: req.user!.id
    };

    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user!.id,
        isRead: false
      }
    });

    const parsedNotifications = notifications.map(n => ({
      ...n,
      data: typeof n.data === 'string' ? JSON.parse(n.data) : n.data
    }));

    res.json({
      success: true,
      data: {
        notifications: parsedNotifications,
        unreadCount
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    res.json({
      success: true,
      message: 'Notificación marcada como leída'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};
