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
      division,
      medidas,
      tiempo_entrega,
      unidad_empaque,
      pedido_minimo,
      colores_disponibles,
      descuentos_volumen,
      fuente_tasa,
      tasa_manual,
      url_catalogo,
      isPublic,
      pesoUnitarioKg,
      empaqueCantidad,
      empaquePesoKg,
      empaqueLargoCm,
      empaqueAnchoCm,
      empaqueAltoCm,
      descuentoDivisasTipo,
      descuentoDivisasValor,
      forSale,
      costPrice,
      packagingCost
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: { message: 'El nombre del producto es requerido' } });
    }

    if (projectId) {
      const resolvedProjectId = projectId === '' ? null : projectId;
      if (resolvedProjectId) {
        const hasAccess = await checkProjectWriteAccess(req.user!, resolvedProjectId);
        if (!hasAccess) {
          return res.status(403).json({ success: false, error: { message: 'No tienes permisos para crear productos en este proyecto' } });
        }
      }
    }

    const product = await prisma.product.create({
      data: {
        name,
        sku,
        description,
        unitPrice: unitPrice || 0,
        currency,
        projectId: projectId || null,
        unit,
        taxable,
        taxRate: taxRate || 0,
        stock: stock || 0,
        division: division || 'Aludra Terra (Agro)',
        medidas,
        tiempo_entrega: tiempo_entrega || '24 horas',
        unidad_empaque,
        pedido_minimo,
        colores_disponibles: colores_disponibles ? JSON.stringify(colores_disponibles) : '["Consultar"]',
        descuentos_volumen,
        fuente_tasa: fuente_tasa || 'bcv',
        tasa_manual: tasa_manual ? parseFloat(tasa_manual) : null,
        url_catalogo: url_catalogo || 'https://catalogo.grupoaludra.com',
        isPublic: isPublic !== undefined ? isPublic : true,
        pesoUnitarioKg: pesoUnitarioKg ? parseFloat(pesoUnitarioKg) : 0,
        empaqueCantidad: empaqueCantidad ? parseInt(empaqueCantidad) : 1,
        empaquePesoKg: empaquePesoKg ? parseFloat(empaquePesoKg) : 0,
        empaqueLargoCm: empaqueLargoCm ? parseFloat(empaqueLargoCm) : 0,
        empaqueAnchoCm: empaqueAnchoCm ? parseFloat(empaqueAnchoCm) : 0,
        empaqueAltoCm: empaqueAltoCm ? parseFloat(empaqueAltoCm) : 0,
        descuentoDivisasTipo: descuentoDivisasTipo || 'dinamico',
        descuentoDivisasValor: descuentoDivisasValor ? parseFloat(descuentoDivisasValor) : 0,
        forSale: forSale !== undefined ? forSale : true,
        costPrice: costPrice ? parseFloat(costPrice) : 0,
        packagingCost: packagingCost ? parseFloat(packagingCost) : 0,
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
    const { 
      name, sku, description, unitPrice, currency, isActive, unit, taxable, taxRate, stock, projectId,
      division, medidas, tiempo_entrega, unidad_empaque, pedido_minimo, 
      colores_disponibles, descuentos_volumen, fuente_tasa, tasa_manual, url_catalogo, isPublic,
      pesoUnitarioKg, empaqueCantidad, empaquePesoKg, empaqueLargoCm, empaqueAnchoCm, empaqueAltoCm,
      descuentoDivisasTipo, descuentoDivisasValor, forSale,
      costPrice, packagingCost
    } = req.body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Producto no encontrado' } });

    if (existing.projectId) {
      const hasAccess = await checkProjectWriteAccess(req.user!, existing.projectId);
      if (!hasAccess) {
        return res.status(403).json({ success: false, error: { message: 'No tienes permisos para modificar este producto' } });
      }
    }

    if (projectId !== undefined) {
      const resolvedProjectId = projectId || null;
      if (resolvedProjectId) {
        const hasAccess = await checkProjectWriteAccess(req.user!, resolvedProjectId);
        if (!hasAccess) {
          return res.status(403).json({ success: false, error: { message: 'No tienes permisos para asignar este producto a este proyecto' } });
        }
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
        ...(projectId !== undefined && { projectId: projectId || null }),
        ...(division !== undefined && { division }),
        ...(medidas !== undefined && { medidas }),
        ...(tiempo_entrega !== undefined && { tiempo_entrega }),
        ...(unidad_empaque !== undefined && { unidad_empaque }),
        ...(pedido_minimo !== undefined && { pedido_minimo }),
        ...(colores_disponibles !== undefined && { colores_disponibles: JSON.stringify(colores_disponibles) }),
        ...(descuentos_volumen !== undefined && { descuentos_volumen }),
        ...(fuente_tasa !== undefined && { fuente_tasa }),
        ...(tasa_manual !== undefined && { tasa_manual: tasa_manual ? parseFloat(tasa_manual) : null }),
        ...(url_catalogo !== undefined && { url_catalogo }),
        ...(isPublic !== undefined && { isPublic }),
        ...(pesoUnitarioKg !== undefined && { pesoUnitarioKg: parseFloat(pesoUnitarioKg) }),
        ...(empaqueCantidad !== undefined && { empaqueCantidad: parseInt(empaqueCantidad) }),
        ...(empaquePesoKg !== undefined && { empaquePesoKg: parseFloat(empaquePesoKg) }),
        ...(empaqueLargoCm !== undefined && { empaqueLargoCm: parseFloat(empaqueLargoCm) }),
        ...(empaqueAnchoCm !== undefined && { empaqueAnchoCm: parseFloat(empaqueAnchoCm) }),
        ...(empaqueAltoCm !== undefined && { empaqueAltoCm: parseFloat(empaqueAltoCm) }),
        ...(descuentoDivisasTipo !== undefined && { descuentoDivisasTipo }),
        ...(descuentoDivisasValor !== undefined && { descuentoDivisasValor: parseFloat(descuentoDivisasValor) }),
        ...(forSale !== undefined && { forSale }),
        ...(costPrice !== undefined && { costPrice: costPrice !== null ? parseFloat(costPrice) : 0 }),
        ...(packagingCost !== undefined && { packagingCost: packagingCost !== null ? parseFloat(packagingCost) : 0 }),
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

// POST /api/products/bulk-sync-costs
export const bulkSyncCosts = async (req: Request, res: Response) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: { message: 'El cuerpo de la solicitud debe ser un arreglo de productos' } });
    }

    let updatedCount = 0;

    for (const item of items) {
      const { sku, costPrice, packagingCost, unitPrice } = item;
      if (!sku) continue;

      const product = await prisma.product.findUnique({ where: { sku } });
      if (product) {
        if (product.projectId) {
          const hasAccess = await checkProjectWriteAccess(req.user!, product.projectId);
          if (!hasAccess) {
            continue; // Saltar si no tiene acceso
          }
        }

        await prisma.product.update({
          where: { sku },
          data: {
            costPrice: costPrice !== undefined && costPrice !== null ? parseFloat(costPrice) : undefined,
            packagingCost: packagingCost !== undefined && packagingCost !== null ? parseFloat(packagingCost) : undefined,
            unitPrice: unitPrice !== undefined && unitPrice !== null ? parseFloat(unitPrice) : undefined,
          }
        });
        updatedCount++;
      }
    }

    res.json({ success: true, updatedCount });
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
  bulkSyncCosts,
};
