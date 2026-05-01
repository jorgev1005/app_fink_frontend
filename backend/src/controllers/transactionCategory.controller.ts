import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getProjectAccessFilter, checkProjectWriteAccess } from '../utils/projectAccess';

const prisma = new PrismaClient();

export const getTransactionCategoriesNormalized = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    const where: any = {
      ...getProjectAccessFilter(req.user!)
    };
    if (projectId) where.projectId = projectId as string;

    const categories = await prisma.transactionCategory.findMany({ where, orderBy: { name: 'asc' } });
    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const createTransactionCategory = async (req: Request, res: Response) => {
  try {
    const { name, projectId } = req.body;
    if (!name || typeof name !== 'string') return res.status(400).json({ success: false, error: { message: 'Name is required' } });
    
    if (projectId) {
      const hasAccess = await checkProjectWriteAccess(req.user!, projectId);
      if (!hasAccess) {
        return res.status(403).json({ success: false, error: { message: 'No tienes permisos para crear categorías en este proyecto' } });
      }
    }

    // Buscar si existe una categoría con el mismo nombre (ignorando mayúsculas/minúsculas)
    // SQLite no soporta mode: 'insensitive' en Prisma, así que buscamos todas y filtramos en memoria
    const allCategories = await prisma.transactionCategory.findMany();
    
    const existing = allCategories.find(c => c.name.toLowerCase() === name.trim().toLowerCase());
    
    if (existing) {
      // Si ya existe, en lugar de dar error, simplemente devolvemos la existente
      // Esto evita el error de "Unique constraint failed" cuando el usuario intenta crear una que ya existe
      return res.status(200).json({ success: true, data: existing });
    }
    
    const created = await prisma.transactionCategory.create({ data: { name: name.trim(), projectId } });
    res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const updateTransactionCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || typeof name !== 'string') return res.status(400).json({ success: false, error: { message: 'Name is required' } });

    const existing = await prisma.transactionCategory.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Category not found' } });

    if (existing.projectId) {
      const hasAccess = await checkProjectWriteAccess(req.user!, existing.projectId);
      if (!hasAccess) {
        return res.status(403).json({ success: false, error: { message: 'No tienes permisos para modificar esta categoría' } });
      }
    }

    const updated = await prisma.transactionCategory.update({ where: { id }, data: { name: name.trim() } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const deleteTransactionCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.transactionCategory.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Category not found' } });

    if (existing.projectId) {
      const hasAccess = await checkProjectWriteAccess(req.user!, existing.projectId);
      if (!hasAccess) {
        return res.status(403).json({ success: false, error: { message: 'No tienes permisos para eliminar esta categoría' } });
      }
    }

    // Optionally, prevent deletion if associated transactions exist
    const count = await prisma.transaction.count({ where: { categoryId: id } });
    if (count > 0) {
      return res.status(400).json({ success: false, error: { message: 'Cannot delete category with associated transactions' } });
    }
    await prisma.transactionCategory.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
