import { Request, Response } from 'express';
import prisma from '../config/database';
import { checkProjectWriteAccess, getProjectAccessFilter } from '../utils/projectAccess';

export const createTemplate = async (req: Request, res: Response) => {
  try {
    const {
      name,
      projectId,
      type,
      description,
      categoryId,
      contactPersonId,
      currency,
      amount,
      debitAccountId,
      creditAccountId,
      paymentMethod,
      lines
    } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ success: false, error: { message: 'Project ID and Name are required' } });
    }

    const hasAccess = await checkProjectWriteAccess(req.user!, projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para crear plantillas en este proyecto' } });
    }

    const template = await prisma.transactionTemplate.create({
      data: {
        name,
        projectId,
        type,
        description,
        categoryId,
        contactPersonId,
        currency,
        amount: amount ? Number(amount) : undefined,
        debitAccountId,
        creditAccountId,
        paymentMethod,
        lines: lines ? JSON.stringify(lines) : undefined
      }
    });

    return res.json({ success: true, data: template });
  } catch (error: any) {
    console.error('Error creating template:', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getTemplates = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ success: false, error: { message: 'Project ID is required' } });
    }

    const templates = await prisma.transactionTemplate.findMany({
      where: { 
        projectId: String(projectId),
        ...getProjectAccessFilter(req.user!)
      },
      orderBy: { createdAt: 'desc' }
    });

    // Parse lines JSON
    const parsed = templates.map((t: any) => ({
      ...t,
      lines: t.lines ? JSON.parse(t.lines) : []
    }));

    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.transactionTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Template not found' } });

    const hasAccess = await checkProjectWriteAccess(req.user!, existing.projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para eliminar esta plantilla' } });
    }

    await prisma.transactionTemplate.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};
