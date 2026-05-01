import { Request, Response } from 'express';
import prisma from '../config/database';
import { getProjectAccessFilter, checkProjectWriteAccess } from '../utils/projectAccess';

// GET /api/products - listar productos (opcional por proyecto y búsqueda)
export const getProducts = async (req: Request, res: Response) => {
  try {
    const { projectId, search, limit = '50' } = req.query;
    const where: any = { 
      isActive: true,
      ...getProjectAccessFilter(req.user!)
    };
    if (projectId) where.projectId = projectId as string;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      take: parseInt(limit as string),
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: products });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// GET /api/products/:id
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findFirst({ 
      where: { 
        id,
        ...getProjectAccessFilter(req.user!)
      } 
    });
    if (!product) return res.status(404).json({ success: false, error: { message: 'Producto no encontrado' } });
    res.json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// POST /api/products
export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      name,
      sku,
      description,
      unitPrice = 0,
      currency = 'USD',
      projectId,
      unit,
      taxable = true,
      taxRate = 0,
      stock = 0,
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: { message: 'El nombre del producto es requerido' } });
    }

    if (projectId) {
      const hasAccess = await checkProjectWriteAccess(req.user!, projectId);
      if (!hasAccess) {
        return res.status(403).json({ success: false, error: { message: 'No tienes permisos para crear productos en este proyecto' } });
      }
    }

    const product = await prisma.product.create({
      data: {
        name,
        sku,
        description,
        unitPrice: unitPrice || 0,
        currency,
        projectId,
        unit,
        taxable,
        taxRate: taxRate || 0,
        stock: stock || 0,
      },
    });

    res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// PUT /api/products/:id
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, sku, description, unitPrice, currency, isActive, unit, taxable, taxRate, stock } = req.body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Producto no encontrado' } });

    if (existing.projectId) {
      const hasAccess = await checkProjectWriteAccess(req.user!, existing.projectId);
      if (!hasAccess) {
        return res.status(403).json({ success: false, error: { message: 'No tienes permisos para modificar este producto' } });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(sku !== undefined && { sku }),
        ...(description !== undefined && { description }),
        ...(unitPrice !== undefined && { unitPrice }),
        ...(currency !== undefined && { currency }),
        ...(isActive !== undefined && { isActive }),
        ...(unit !== undefined && { unit }),
        ...(taxable !== undefined && { taxable }),
        ...(taxRate !== undefined && { taxRate }),
        ...(stock !== undefined && { stock }),
      },
    });

    res.json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// DELETE /api/products/:id -> desactivar
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Producto no encontrado' } });

    if (existing.projectId) {
      const hasAccess = await checkProjectWriteAccess(req.user!, existing.projectId);
      if (!hasAccess) {
        return res.status(403).json({ success: false, error: { message: 'No tienes permisos para eliminar este producto' } });
      }
    }

    const product = await prisma.product.update({ where: { id }, data: { isActive: false } });
    res.json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export default {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
