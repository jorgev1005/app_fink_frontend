import { Request, Response } from 'express';
import prisma from '../config/database';

// Endpoint: GET /api/audit/account-log
// Params: ?projectId=&accountId=&startDate=&endDate=&adminKey=
export const getAccountAuditLog = async (req: Request, res: Response) => {
  try {
    const { projectId, accountId, startDate, endDate, adminKey } = req.query;

    // Clave especial de administrador (puedes cambiarla por una variable de entorno)
    const ADMIN_KEY = process.env.AUDIT_ADMIN_KEY || 'supersecreta2026';
    if (!adminKey || adminKey !== ADMIN_KEY) {
      return res.status(403).json({ success: false, error: { message: 'Acceso restringido: clave de administrador inválida.' } });
    }

    if (!accountId) {
      return res.status(400).json({ success: false, error: { message: 'accountId es requerido' } });
    }

    const where: any = {
      entity: 'Account',
      entityId: String(accountId),
    };
    if (projectId) where['metadata'] = { contains: projectId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(String(startDate));
      if (endDate) where.createdAt.lte = new Date(String(endDate));
    }

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
