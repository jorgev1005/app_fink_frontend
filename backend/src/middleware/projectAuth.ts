import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';

const ROLE_HIERARCHY: Record<string, number> = {
  'VIEWER': 1,
  'MEMBER': 2, // Editor
  'MANAGER': 3,
  'OWNER': 4
};

export const authorizeProjectRole = (minRole: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: { message: 'No autenticado' } });
      }

      // Admin global siempre tiene acceso
      if (req.user.role === 'ADMIN') {
        return next();
      }

      const projectId = req.params.projectId || req.params.id || req.body.projectId;

      if (!projectId) {
        return res.status(400).json({ success: false, error: { message: 'Project ID is required' } });
      }

      if (!req.user.id) {
        console.error('[projectAuth] req.user.id missing:', req.user);
        return res.status(401).json({ success: false, error: { message: 'No autenticado (user.id missing)' } });
      }
      const membership = await prisma.projectUser.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: req.user.id
          }
        }
      });
      if (!membership) {
        return res.status(403).json({ success: false, error: { message: 'No tienes acceso a este proyecto' } });
      }

      const userLevel = ROLE_HIERARCHY[membership.role.toUpperCase()] || 0;
      const requiredLevel = ROLE_HIERARCHY[minRole.toUpperCase()] || 0;

      if (userLevel < requiredLevel) {
        return res.status(403).json({ 
          success: false, 
          error: { message: `Permiso insuficiente. Requieres rol ${minRole} o superior.` } 
        });
      }

      // Attach membership to request for later use if needed
      (req as any).projectMembership = membership;
      next();
    } catch (error) {
      console.error('Project auth error:', error);
      res.status(500).json({ success: false, error: { message: 'Error de autorización' } });
    }
  };
};
