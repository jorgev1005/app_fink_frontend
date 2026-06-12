// Pausar proyecto
export const pauseProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.update({
      where: { id },
      data: { status: 'PAUSED' }
    });
    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// Reactivar proyecto
export const reactivateProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.update({
      where: { id },
      data: { status: 'ACTIVE' }
    });
    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
import { Request, Response } from 'express';
import prisma from '../config/database';
import fs from 'fs';
import path from 'path';

export const createProject = async (req: Request, res: Response) => {
  try {
    const { name, description, status, color, icon, logoUrl, initialCapitalBs, initialCapitalUsd, initialCapitalEur, sourceProjectId, includeBalances } = req.body;
    let { code } = req.body;

    // Lógica de generación y validación de código
    if (code && code.trim().length > 0) {
      code = code.trim();
      const existing = await prisma.project.findUnique({ where: { code } });
      if (existing) {
        return res.status(409).json({ success: false, error: { message: `El código '${code}' ya está en uso. Por favor elija otro o deje el campo vacío.` } });
      }
    } else {
      // Generar código automático si no se provee
      let prefix = 'PRJ';
      if (name && name.length >= 3) {
        prefix = name.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
      }
      
      let nextNum = (await prisma.project.count()) + 1;
      let candidate = `${prefix}-${String(nextNum).padStart(2, '0')}`;
      
      // Asegurar unicidad
      while (await prisma.project.findUnique({ where: { code: candidate } })) {
        nextNum++;
        candidate = `${prefix}-${String(nextNum).padStart(2, '0')}`;
      }
      code = candidate;
    }

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name,
          description,
          code,
          status: status || 'ACTIVE',
          color: color || '#3B82F6',
          icon,
          logoUrl,
          initialCapitalBs: initialCapitalBs || 0,
          initialCapitalUsd: initialCapitalUsd || 0,
          initialCapitalEur: initialCapitalEur || 0,
          users: {
            create: {
              userId: req.user!.id,
              role: 'owner'
            }
          }
        }
      });

      // Clone accounts if sourceProjectId is provided
      if (sourceProjectId) {
        const sourceAccounts = await tx.account.findMany({
          where: { projectId: sourceProjectId }
        });

        // Map oldId -> newId
        const idMap = new Map<string, string>();
        
        // First pass: Create accounts without parentId
        for (const acc of sourceAccounts) {
          const newAccount = await tx.account.create({
            data: {
              projectId: project.id,
              code: acc.code,
              name: acc.name,
              description: acc.description,
              type: acc.type,
              subType: acc.subType,
              isActive: acc.isActive,
              // Copy balances if requested
              balanceBs: includeBalances ? acc.balanceBs : 0,
              balanceUsd: includeBalances ? acc.balanceUsd : 0,
              balanceEur: includeBalances ? acc.balanceEur : 0,
            }
          });
          idMap.set(acc.id, newAccount.id);
        }

        // Second pass: Update parentId
        for (const acc of sourceAccounts) {
          if (acc.parentId && idMap.has(acc.parentId)) {
            const newId = idMap.get(acc.id);
            const newParentId = idMap.get(acc.parentId);
            if (newId && newParentId) {
              await tx.account.update({
                where: { id: newId },
                data: { parentId: newParentId }
              });
            }
          }
        }
      }

      return project;
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

export const getProjects = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const whereClause = user.role === 'ADMIN' ? {} : {
      users: {
        some: {
          userId: user.id
        }
      }
    };

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            transactions: true,
            documents: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: projects
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const whereClause: any = { id };
    if (user.role !== 'ADMIN') {
      whereClause.users = {
        some: {
          userId: user.id
        }
      };
    }

    const project = await prisma.project.findFirst({
      where: whereClause,
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Proyecto no encontrado' }
      });
    }

    res.json({
      success: true,
      data: project
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

import { checkProjectWriteAccess } from '../utils/projectAccess';

export const updateProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, code, status, color, startDate, initialCapitalBs, initialCapitalUsd, initialCapitalEur, defaultTaxRate, lastInvoiceNumber, lastDeliveryNoteNumber } = req.body;

    const hasAccess = await checkProjectWriteAccess(req.user!, id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para modificar este proyecto' } });
    }

    // No permitir modificar si el proyecto está pausado (a menos que sea para reactivar, que se hace por otro endpoint, o si se permite editar metadatos básicos)
    const current = await prisma.project.findUnique({ where: { id } });
    if (current?.status === 'PAUSED' && status !== 'ACTIVE') {
      return res.status(403).json({ success: false, error: { message: 'No se puede modificar un proyecto pausado.' } });
    }

    // Build update object safely to avoid overwriting fields like logoUrl with null if not provided
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (code !== undefined) updateData.code = code;
    if (status !== undefined) updateData.status = status;
    if (color !== undefined) updateData.color = color;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (initialCapitalBs !== undefined) updateData.initialCapitalBs = initialCapitalBs;
    if (initialCapitalUsd !== undefined) updateData.initialCapitalUsd = initialCapitalUsd;
    if (initialCapitalEur !== undefined) updateData.initialCapitalEur = initialCapitalEur;
    if (defaultTaxRate !== undefined) updateData.defaultTaxRate = defaultTaxRate !== null ? Number(defaultTaxRate) : 16;
    if (lastInvoiceNumber !== undefined) updateData.lastInvoiceNumber = lastInvoiceNumber;
    if (lastDeliveryNoteNumber !== undefined) updateData.lastDeliveryNoteNumber = lastDeliveryNoteNumber;
    
    // Explicitly DO NOT update logoUrl here. It is handled by uploadProjectLogo only.

    const project = await prisma.project.update({
      where: { id },
      data: updateData
    });
    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const hasAccess = await checkProjectWriteAccess(req.user!, id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para eliminar este proyecto' } });
    }

    await prisma.project.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Proyecto eliminado exitosamente'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

export const getProjectSummary = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const whereClause: any = { id };
    if (user.role !== 'ADMIN') {
      whereClause.users = {
        some: {
          userId: user.id
        }
      };
    }

    const project = await prisma.project.findFirst({
      where: whereClause,
      include: {
        transactions: true,
        documents: true,
        accounts: true
      }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Proyecto no encontrado' }
      });
    }

    const income = project.transactions
      .filter((t: any) => t.type === 'INCOME')
      .reduce((sum: number, t: any) => sum + Number(t.amountUsd), 0);

    const expenses = project.transactions
      .filter((t: any) => t.type === 'EXPENSE')
      .reduce((sum: number, t: any) => sum + Number(t.amountUsd), 0);

    const balance = income - expenses;

    const pendingDocuments = project.documents.filter((d: any) => d.status === 'PENDING').length;
    const overdueDocuments = project.documents.filter((d: any) => d.status === 'OVERDUE').length;

    res.json({
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          code: project.code
        },
        summary: {
          income,
          expenses,
          balance,
          transactionCount: project.transactions.length,
          pendingDocuments,
          overdueDocuments,
          accountCount: project.accounts.length
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

export const uploadProjectLogo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No se subió ningún archivo' } });
    }
    
    // Construct public URL
    const filename = req.file.filename;
    const logoUrl = `/uploads/logos/${filename}`;
    
    // Find previous logo to delete to save space and keep it clean
    const currentProject = await prisma.project.findUnique({ where: { id }, select: { logoUrl: true } });
    if (currentProject?.logoUrl) {
        try {
            const oldFilename = currentProject.logoUrl.split('/').pop();
            if (oldFilename) {
                 const oldPath = path.join(__dirname, '../../uploads/logos', oldFilename);
                 if (fs.existsSync(oldPath)) {
                     fs.unlinkSync(oldPath);
                 }
            }
        } catch (err) {
            console.error('Error deleting old logo:', err);
            // Continue even if delete fails
        }
    }

    // Update DB
    const project = await prisma.project.update({
      where: { id },
      data: { logoUrl }
    });
    
    res.json({ success: true, data: { logoUrl, project } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

