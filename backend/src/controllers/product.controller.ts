import { Request, Response } from 'express';
import prisma from '../config/database';
import { getProjectAccessFilter, checkProjectWriteAccess } from '../utils/projectAccess';

// GET /api/products - listar productos (opcional por proyecto y búsqueda)
export const getProducts = async (req: Request, res: Response) => {
  try {
    const { projectId, search, limit = '3000' } = req.query;
    const where: any = { 
      isActive: true,
      ...getProjectAccessFilter(req.user!)
    };
    if (projectId) where.projectId = projectId as string;
    if (req.query.forSale === 'true') where.forSale = true;
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

    const exchangeRate = await prisma.exchangeRate.findFirst({
      orderBy: { date: 'desc' },
    });

    res.json({ success: true, data: products, exchangeRate });
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
      largoCm,
      anchoCm,
      altoCm,
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
        largoCm: largoCm ? parseFloat(largoCm) : 0,
        anchoCm: anchoCm ? parseFloat(anchoCm) : 0,
        altoCm: altoCm ? parseFloat(altoCm) : 0,
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
      largoCm, anchoCm, altoCm,
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
        ...(largoCm !== undefined && { largoCm: parseFloat(largoCm) }),
        ...(anchoCm !== undefined && { anchoCm: parseFloat(anchoCm) }),
        ...(altoCm !== undefined && { altoCm: parseFloat(altoCm) }),
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

// POST /api/products/transfer
export const transferProductStock = async (req: Request, res: Response) => {
  try {
    const { productId, toProjectId, quantity, notes } = req.body;
    const qty = parseFloat(quantity);

    if (!productId || !toProjectId || isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'El producto de origen, proyecto de destino y una cantidad válida mayor a 0 son requeridos.' }
      });
    }

    // 1. Obtener producto de origen
    const sourceProduct = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!sourceProduct || !sourceProduct.isActive) {
      return res.status(404).json({
        success: false,
        error: { message: 'El producto de origen no fue encontrado o está inactivo.' }
      });
    }

    if (sourceProduct.projectId === toProjectId) {
      return res.status(400).json({
        success: false,
        error: { message: 'El proyecto de destino debe ser diferente al proyecto de origen.' }
      });
    }

    // Permisos del usuario
    if (sourceProduct.projectId) {
      const hasSourceAccess = await checkProjectWriteAccess(req.user!, sourceProduct.projectId);
      if (!hasSourceAccess) {
        return res.status(403).json({
          success: false,
          error: { message: 'No tienes permisos para transferir productos de este proyecto de origen.' }
        });
      }
    }

    const hasTargetAccess = await checkProjectWriteAccess(req.user!, toProjectId);
    if (!hasTargetAccess) {
      return res.status(403).json({
        success: false,
        error: { message: 'No tienes permisos para recibir productos en este proyecto de destino.' }
      });
    }

    if (sourceProduct.stock < qty) {
      return res.status(400).json({
        success: false,
        error: { message: `Stock insuficiente en el proyecto de origen. Disponible: ${sourceProduct.stock}, Solicitado: ${qty}` }
      });
    }

    const targetProject = await prisma.project.findUnique({ where: { id: toProjectId } });
    const sourceProject = sourceProduct.projectId
      ? await prisma.project.findUnique({ where: { id: sourceProduct.projectId } })
      : null;

    if (!targetProject) {
      return res.status(404).json({
        success: false,
        error: { message: 'El proyecto de destino no existe.' }
      });
    }

    // Transacción atómica en base de datos
    const result = await prisma.$transaction(async (tx) => {
      // 1. Restar stock en origen
      const updatedSource = await tx.product.update({
        where: { id: productId },
        data: { stock: sourceProduct.stock - qty }
      });

      // 2. Buscar si ya existe el producto en el proyecto destino
      let targetProduct = null;
      if (sourceProduct.sku) {
        targetProduct = await tx.product.findFirst({
          where: {
            projectId: toProjectId,
            sku: sourceProduct.sku,
            isActive: true
          }
        });
      }

      if (!targetProduct) {
        targetProduct = await tx.product.findFirst({
          where: {
            projectId: toProjectId,
            name: sourceProduct.name,
            isActive: true
          }
        });
      }

      if (targetProduct) {
        // Incrementar el stock en destino
        targetProduct = await tx.product.update({
          where: { id: targetProduct.id },
          data: { stock: targetProduct.stock + qty }
        });
      } else {
        // Duplicar ficha técnica y crear producto en proyecto destino
        let targetSku = sourceProduct.sku ? `${sourceProduct.sku}-${targetProject.code}` : undefined;
        if (targetSku) {
          const existingSku = await tx.product.findUnique({ where: { sku: targetSku } });
          if (existingSku) {
            targetSku = `${sourceProduct.sku}-${Date.now().toString().slice(-4)}`;
          }
        }

        targetProduct = await tx.product.create({
          data: {
            projectId: toProjectId,
            sku: targetSku,
            name: sourceProduct.name,
            description: sourceProduct.description,
            unitPrice: sourceProduct.unitPrice,
            costPrice: sourceProduct.costPrice,
            packagingCost: sourceProduct.packagingCost,
            currency: sourceProduct.currency,
            unit: sourceProduct.unit,
            taxable: sourceProduct.taxable,
            taxRate: sourceProduct.taxRate,
            stock: qty,
            division: sourceProduct.division,
            medidas: sourceProduct.medidas,
            tiempo_entrega: sourceProduct.tiempo_entrega,
            unidad_empaque: sourceProduct.unidad_empaque,
            pedido_minimo: sourceProduct.pedido_minimo,
            colores_disponibles: sourceProduct.colores_disponibles,
            descuentos_volumen: sourceProduct.descuentos_volumen,
            fuente_tasa: sourceProduct.fuente_tasa,
            tasa_manual: sourceProduct.tasa_manual,
            url_catalogo: sourceProduct.url_catalogo,
            pesoUnitarioKg: sourceProduct.pesoUnitarioKg,
            empaqueCantidad: sourceProduct.empaqueCantidad,
            empaquePesoKg: sourceProduct.empaquePesoKg,
            empaqueLargoCm: sourceProduct.empaqueLargoCm,
            empaqueAnchoCm: sourceProduct.empaqueAnchoCm,
            empaqueAltoCm: sourceProduct.empaqueAltoCm,
            largoCm: sourceProduct.largoCm,
            anchoCm: sourceProduct.anchoCm,
            altoCm: sourceProduct.altoCm,
            descuentoDivisasTipo: sourceProduct.descuentoDivisasTipo,
            descuentoDivisasValor: sourceProduct.descuentoDivisasValor,
            forSale: sourceProduct.forSale,
            isPublic: sourceProduct.isPublic
          }
        });
      }

      // 3. Log de auditoría
      await tx.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'INVENTORY_TRANSFER',
          entity: 'Product',
          entityId: sourceProduct.id,
          description: `Traspaso de ${qty} ${sourceProduct.unit || 'unidades'} del producto "${sourceProduct.name}" desde proyecto "${sourceProject?.name || 'General'}" hacia proyecto "${targetProject.name}". ${notes ? `Notas: ${notes}` : ''}`,
          metadata: JSON.stringify({
            fromProjectId: sourceProduct.projectId,
            toProjectId,
            quantity: qty,
            notes
          })
        }
      });

      return { sourceProduct: updatedSource, targetProduct };
    });

    res.json({
      success: true,
      message: `Traspaso exitoso de ${qty} unidades hacia el proyecto ${targetProject.name}`,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// GET /api/products/export/price-list-pdf
export const exportPriceListPDF = async (req: Request, res: Response) => {
  try {
    const { projectId, adjustmentPercentage = '0', tasaOverride, excludeKeywords, includeKeywords } = req.query;

    const where: any = { 
      isActive: true,
      forSale: true,
      ...getProjectAccessFilter(req.user!)
    };

    if (projectId && projectId !== 'all') {
      where.projectId = projectId as string;
    }

    let products = await prisma.product.findMany({
      where,
      orderBy: [
        { division: 'asc' },
        { name: 'asc' }
      ]
    });

    // 1. Filtrar por palabras clave a INCLUIR (si se especifican, ej: "tuberia, caja, abrazadera")
    if (includeKeywords && typeof includeKeywords === 'string') {
      const incKeywords = includeKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      if (incKeywords.length > 0) {
        products = products.filter(p => {
          const textToSearch = `${p.name} ${p.sku || ''} ${p.description || ''} ${p.division || ''}`.toLowerCase();
          return incKeywords.some(kw => textToSearch.includes(kw));
        });
      }
    }

    // 2. Filtrar por palabras clave a EXCLUIR (si se especifican)
    if (excludeKeywords && typeof excludeKeywords === 'string') {
      const excKeywords = excludeKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      if (excKeywords.length > 0) {
        products = products.filter(p => {
          const textToSearch = `${p.name} ${p.sku || ''} ${p.description || ''} ${p.division || ''}`.toLowerCase();
          const isExcluded = excKeywords.some(kw => textToSearch.includes(kw));
          return !isExcluded;
        });
      }
    }

    const latestRate = await prisma.exchangeRate.findFirst({
      orderBy: { date: 'desc' },
    });

    const tasaBCV = tasaOverride ? parseFloat(tasaOverride as string) : (latestRate?.usdToBs || 36.50);
    const tasaParalelo = undefined;
    const tasaEUR = latestRate?.eurToBs || undefined;

    let projectName: string | undefined = undefined;
    if (projectId && projectId !== 'all') {
      const proj = await prisma.project.findUnique({ where: { id: projectId as string } });
      if (proj) projectName = proj.name;
    }

    const { generatePriceListPDFBuffer } = require('../services/pdfPriceList.service');
    const pdfBuffer = await generatePriceListPDFBuffer({
      products: products.map(p => ({
        sku: p.sku || undefined,
        name: p.name,
        unitPrice: p.unitPrice,
        division: p.division || undefined,
        unit: p.unit || undefined,
        empaqueCantidad: p.empaqueCantidad || undefined,
      })),
      tasaBCV,
      tasaParalelo,
      tasaEUR,
      adjustmentPercentage: parseFloat(adjustmentPercentage as string) || 0,
      projectName
    });

    const filename = `Lista_Precios_Aludra_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error('Error generando PDF de lista de precios:', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export default {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkSyncCosts,
  transferProductStock,
  exportPriceListPDF,
};


