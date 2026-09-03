import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import { generatePurchaseOrderPDFBuffer } from '../services/purchaseOrderPdf.service';
import { generateQuotationPDFBuffer } from '../services/quotationPdf.service';

function getHistoryPaths(): string[] {
  const root = process.cwd();
  return [
    path.join(root, 'data', 'cotizaciones_historial.json'),
    path.join(root, 'uploads', 'cotizaciones_historial.json'),
    path.join(root, '..', 'data', 'cotizaciones_historial.json'),
    path.join(root, '..', '..', 'asistente', 'cotizaciones_historial.json'),
    path.join(root, '..', '..', 'pagina web de tools', 'catalogo_aludra', 'src', 'data', 'cotizaciones_historial.json'),
    path.join('/home/fink', 'cotizaciones_historial.json'),
    path.join('/home/fink/app_fink', 'cotizaciones_historial.json'),
    path.join('/home/fink/app_fink/backend/data', 'cotizaciones_historial.json'),
    path.join('/home/fink/asistente', 'cotizaciones_historial.json')
  ];
}

function loadAllQuotes(): any[] {
  const paths = getHistoryPaths();
  for (const p of paths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          return data.filter(item => item && typeof item === 'object');
        }
      } catch (err) {
        console.warn('Error reading quote file from ' + p, err);
      }
    }
  }
  return [];
}

function saveAllQuotes(quotes: any[]): void {
  const paths = getHistoryPaths();
  paths.forEach(filePath => {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(quotes, null, 2), 'utf8');
    } catch (e) {
      // Ignored for non-writable paths
    }
  });
}

// POST /api/quotations — Registra una cotización emitida desde el Catálogo Web o POS
export const createQuotation = async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body) {
      return res.status(400).json({ success: false, error: { message: 'Datos de cotización requeridos' } });
    }

    const quotes = loadAllQuotes();
    const correlative = body.correlative || body.id || `COT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const quoteRecord = {
      id: correlative,
      correlative,
      createdAt: body.createdAt || new Date().toISOString(),
      channel: body.channel || 'CATALOGO_WEB',
      customer: {
        name: body.customer?.name || body.clientName || 'Cliente Particular',
        taxId: body.customer?.taxId || body.clientTaxId || '',
        phone: body.customer?.phone || body.clientPhone || '',
        email: body.customer?.email || body.clientEmail || '',
        city: body.customer?.city || body.destinationCity || 'La Victoria, Aragua',
        seller: body.customer?.seller || body.seller || 'Oficina',
        gpsCoordinates: body.customer?.gpsCoordinates || '',
        gpsMapsUrl: body.customer?.gpsMapsUrl || '',
        emissionPlace: body.customer?.emissionPlace || ''
      },
      paymentMethod: body.paymentMethod || 'bcv_bs',
      rates: {
        bcv: Number(body.rates?.bcv || body.tasaBCV || 785.07),
        paralelo: Number(body.rates?.paralelo || 929.80),
        eur: Number(body.rates?.eur || 916.03)
      },
      items: Array.isArray(body.items) ? body.items.map((i: any) => ({
        sku: i.sku || i.product?.sku || 'N/A',
        name: i.name || i.product?.name || '',
        quantity: Number(i.quantity || 1),
        unit: i.unit || i.product?.unit || 'UNIDAD',
        unitPriceUSD: Number(i.unitPriceUSD || i.unitPrice || 0),
        unitPriceBs: Number(i.unitPriceBs || (Number(i.unitPriceUSD || i.unitPrice || 0) * Number(body.rates?.bcv || 785.07))),
        subtotalUSD: Number(i.subtotalUSD || (Number(i.unitPriceUSD || i.unitPrice || 0) * Number(i.quantity || 1))),
        subtotalBs: Number(i.subtotalBs || (Number(i.subtotalUSD || 0) * Number(body.rates?.bcv || 785.07))),
        medidas: i.medidas || i.product?.medidas || ''
      })) : [],
      totalUSD: Number(body.totalUSD || 0),
      totalBs: Number(body.totalBs || (Number(body.totalUSD || 0) * Number(body.rates?.bcv || 785.07))),
      notes: body.notes || '',
      status: body.status || 'PENDING'
    };

    const idx = quotes.findIndex((q: any) => q.id === correlative || q.correlative === correlative);
    if (idx >= 0) {
      const existing = quotes[idx];
      quotes[idx] = {
        ...existing,
        ...quoteRecord,
        status: existing.status || quoteRecord.status || 'PENDING',
        purchaseOrderNumber: (existing as any)?.purchaseOrderNumber || (body as any)?.purchaseOrderNumber,
        invoiceCode: (existing as any)?.invoiceCode || (body as any)?.invoiceCode,
        invoiceId: (existing as any)?.invoiceId || (body as any)?.invoiceId,
        updatedAt: new Date().toISOString()
      };
      console.log(`[FINK] Cotización actualizada exitosamente: ${correlative} para ${quoteRecord.customer.name}`);
    } else {
      quotes.unshift(quoteRecord);
      console.log(`[FINK] Cotización registrada exitosamente: ${correlative} para ${quoteRecord.customer.name}`);
    }

    saveAllQuotes(quotes);

    res.status(201).json({
      success: true,
      message: 'Cotización guardada exitosamente',
      data: quoteRecord
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// GET /api/quotations
export const getQuotations = async (req: Request, res: Response) => {
  try {
    const { status, channel, search, limit = '100', offset = '0' } = req.query;
    let quotes = loadAllQuotes();

    // Normalizar status si viene ausente y filtrar elementos nulos
    quotes = quotes
      .filter(q => q && typeof q === 'object')
      .map(q => ({
        ...q,
        status: q.status || 'PENDING',
        channel: q.channel || (q.correlative?.startsWith('COT-') ? 'CATALOGO_WEB' : 'FINK_POS'),
      }));

    if (status && status !== 'ALL') {
      quotes = quotes.filter(q => q.status === status);
    }

    if (channel && channel !== 'ALL') {
      quotes = quotes.filter(q => q.channel === channel);
    }

    if (search && typeof search === 'string') {
      const s = search.toLowerCase().trim();
      quotes = quotes.filter(q => {
        const correlative = (q.correlative || q.id || '').toLowerCase();
        const clientName = (q.customer?.name || q.clientName || '').toLowerCase();
        const clientPhone = (q.customer?.phone || q.clientPhone || '').toLowerCase();
        const clientTaxId = (q.customer?.taxId || q.clientTaxId || '').toLowerCase();
        const seller = (q.customer?.seller || q.seller || '').toLowerCase();
        const city = (q.customer?.city || q.destinationCity || '').toLowerCase();
        return correlative.includes(s) || clientName.includes(s) || clientPhone.includes(s) || clientTaxId.includes(s) || seller.includes(s) || city.includes(s);
      });
    }

    // Ordenar más recientes primero
    quotes.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const total = quotes.length;
    const start = parseInt(offset as string) || 0;
    const end = start + (parseInt(limit as string) || 100);
    const paginated = quotes.slice(start, end);

    // Calcular estadísticas globales
    const allQuotes = loadAllQuotes();
    const stats = {
      total: allQuotes.length,
      pending: allQuotes.filter(q => !q.status || q.status === 'PENDING').length,
      approved: allQuotes.filter(q => q.status === 'APPROVED').length,
      poGenerated: allQuotes.filter(q => q.status === 'PO_GENERATED').length,
      invoiced: allQuotes.filter(q => q.status === 'INVOICED').length,
      rejected: allQuotes.filter(q => q.status === 'REJECTED').length,
    };

    res.json({
      success: true,
      data: paginated,
      total,
      stats
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// GET /api/quotations/:id
export const getQuotationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const quotes = loadAllQuotes();
    const quote = quotes.find(q => q.id === id || q.correlative === id);

    if (!quote) {
      return res.status(404).json({ success: false, error: { message: 'Cotización no encontrada' } });
    }

    // Enriquecer ítems con datos de costo del inventario FINK
    const items = quote.items || [];
    const enrichedItems = await Promise.all(items.map(async (it: any) => {
      let product: any = null;
      if (it.sku && it.sku !== 'N/A') {
        product = await prisma.product.findFirst({ where: { sku: it.sku } });
      }
      if (!product && it.name) {
        product = await prisma.product.findFirst({ where: { name: it.name } });
      }

      const costPrice = product?.costPrice && product.costPrice > 0 
        ? product.costPrice 
        : (it.unitPriceUSD ? Number((it.unitPriceUSD * 0.85).toFixed(2)) : 0);

      return {
        ...it,
        costPrice,
        stockAvailable: product?.stock || 0,
        empaqueCantidad: product?.empaqueCantidad || it.empaqueCantidad || 1,
        medidas: product?.medidas || it.medidas || '',
        division: product?.division || it.division || '',
        matchedProductId: product?.id || null
      };
    }));

    res.json({
      success: true,
      data: {
        ...quote,
        status: quote.status || 'PENDING',
        channel: quote.channel || (quote.correlative?.startsWith('COT-') ? 'CATALOGO_WEB' : 'FINK_POS'),
        items: enrichedItems
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// PATCH /api/quotations/:id/status
export const updateQuotationStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, rejectionReason, orderNumber } = req.body;

    const validStatuses = ['PENDING', 'APPROVED', 'PO_GENERATED', 'INVOICED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: { message: 'Estado inválido: ' + status } });
    }

    const quotes = loadAllQuotes();
    const idx = quotes.findIndex(q => q.id === id || q.correlative === id);

    if (idx === -1) {
      return res.status(404).json({ success: false, error: { message: 'Cotización no encontrada' } });
    }

    const quote = quotes[idx];
    const user = req.user ? ((req.user as any).firstName || '' + ' ' + ((req.user as any).lastName || '')).trim() : 'Administrador';

    quote.status = status;
    quote.statusUpdatedAt = new Date().toISOString();
    quote.statusUpdatedBy = user;

    if (status === 'APPROVED') {
      quote.approvedAt = new Date().toISOString();
      quote.approvedBy = user;
      if (notes) quote.approvalNotes = notes;
    } else if (status === 'REJECTED') {
      quote.rejectedAt = new Date().toISOString();
      quote.rejectedBy = user;
      quote.rejectionReason = rejectionReason || notes || 'Rechazada por el cliente';
    } else if (status === 'PO_GENERATED') {
      quote.poGeneratedAt = new Date().toISOString();
      quote.poGeneratedBy = user;
      if (orderNumber) quote.purchaseOrderNumber = orderNumber;
    } else if (status === 'INVOICED') {
      quote.invoicedAt = new Date().toISOString();
      quote.invoicedBy = user;
    }

    if (notes) {
      quote.historyNotes = (quote.historyNotes ? quote.historyNotes + '\n' : '') + '[' + new Date().toLocaleString('es-VE') + '] (' + status + ') ' + user + ': ' + notes;
    }

    quotes[idx] = quote;
    saveAllQuotes(quotes);

    // Registro de Auditoría
    try {
      await prisma.activityLog.create({
        data: {
          userId: req.user ? req.user.id : (await prisma.user.findFirst())?.id || '',
          action: 'QUOTATION_STATUS_' + status,
          entity: 'Quotation',
          entityId: quote.correlative || quote.id,
          description: 'Cotización "' + quote.correlative + '" marcada como ' + status + ' por ' + user + '. ' + (notes ? 'Notas: ' + notes : '')
        }
      });
    } catch (_) {}

    res.json({
      success: true,
      message: 'Cotización actualizada a ' + status,
      data: quote
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// POST /api/quotations/:id/generate-po
export const generatePOFromQuotation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      supplierId,
      supplierName = 'SOLO MAYOR / PROVEEDOR',
      supplierTaxId,
      supplierPhone,
      supplierAddress,
      deliveryAddress = 'Almacén Principal La Victoria, Aragua',
      expectedDate = 'Inmediata / 24-48 horas',
      paymentTerms = 'Contado / Según acuerdo comercial',
      notes,
      selectedItems,
      tasaOverride
    } = req.body;

    const quotes = loadAllQuotes();
    const quote = quotes.find(q => q.id === id || q.correlative === id);

    if (!quote) {
      return res.status(404).json({ success: false, error: { message: 'Cotización no encontrada' } });
    }

    const itemsToOrder = (selectedItems && selectedItems.length > 0) ? selectedItems : quote.items;

    if (!itemsToOrder || itemsToOrder.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'No hay productos para incluir en la orden de compra' } });
    }

    // Tasa oficial
    const bcvRate = await prisma.exchangeRate.findFirst({
      where: { source: 'BCV' },
      orderBy: { date: 'desc' },
    });
    const tasaBCV = tasaOverride ? parseFloat(tasaOverride) : (bcvRate?.usdToBs || 771.07);

    // Preparar ítems para la OC con sus costos unitarios
    const poItems = await Promise.all(itemsToOrder.map(async (it: any) => {
      let product: any = null;
      if (it.sku && it.sku !== 'N/A') {
        product = await prisma.product.findFirst({ where: { sku: it.sku } });
      }
      if (!product && it.name) {
        product = await prisma.product.findFirst({ where: { name: it.name } });
      }

      const costPrice = it.costPrice !== undefined && Number(it.costPrice) > 0
        ? Number(it.costPrice)
        : (product?.costPrice && product.costPrice > 0 
            ? product.costPrice 
            : (it.unitPriceUSD ? Number((it.unitPriceUSD * 0.85).toFixed(2)) : 0));

      return {
        sku: it.sku || product?.sku || undefined,
        name: it.name || product?.name,
        quantity: Number(it.quantity || 1),
        unit: it.unit || product?.unit || 'UNIDAD',
        costPrice,
        empaqueCantidad: product?.empaqueCantidad || it.empaqueCantidad || undefined,
        medidas: product?.medidas || it.medidas || undefined,
        notes: it.notes || undefined
      };
    }));

    // Generar PDF formal de Orden de Compra
    const { buffer, orderNumber } = await generatePurchaseOrderPDFBuffer({
      supplierName,
      supplierTaxId,
      supplierPhone,
      supplierAddress,
      deliveryAddress,
      expectedDate,
      paymentTerms,
      tasaBCV,
      items: poItems,
      notes: notes || ('Generada automáticamente desde Cotización ' + quote.correlative + ' para cliente ' + (quote.customer?.name || 'Cliente'))
    });

    // Actualizar estado de la cotización a PO_GENERATED
    const idx = quotes.findIndex(q => q.id === id || q.correlative === id);
    if (idx >= 0) {
      quotes[idx].status = 'PO_GENERATED';
      quotes[idx].poGeneratedAt = new Date().toISOString();
      quotes[idx].poGeneratedBy = req.user ? (((req.user as any).firstName || '') + ' ' + ((req.user as any).lastName || '')).trim() : 'Administrador';
      quotes[idx].purchaseOrderNumber = orderNumber;
      quotes[idx].supplierName = supplierName;
      saveAllQuotes(quotes);
    }

    // Registro de Auditoría
    try {
      await prisma.activityLog.create({
        data: {
          userId: req.user ? req.user.id : (await prisma.user.findFirst())?.id || '',
          action: 'PURCHASE_ORDER_GENERATED_FROM_QUOTATION',
          entity: 'PurchaseOrder',
          entityId: orderNumber,
          description: 'Orden de Compra "' + orderNumber + '" emitida para "' + supplierName + '" desde Cotización "' + quote.correlative + '". Total renglones: ' + poItems.length
        }
      });
    } catch (_) {}

    const filename = orderNumber + '_' + supplierName.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    res.setHeader('X-Order-Number', orderNumber);
    return res.send(buffer);
  } catch (error: any) {
    console.error('Error generando OC desde cotización:', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// GET /api/quotations/:id/pdf
export const viewQuotationPDF = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const quotes = loadAllQuotes();
    const quote = quotes.find(q => q.id === id || q.correlative === id);

    if (!quote) {
      return res.status(404).json({ success: false, error: { message: 'Cotización no encontrada' } });
    }

    const bcvRate = await prisma.exchangeRate.findFirst({
      where: { source: 'BCV' },
      orderBy: { date: 'desc' },
    });

    const tasaBCV = Number(quote.rates?.bcv || bcvRate?.usdToBs || 771.07);

    const { buffer, quotationNumber } = await generateQuotationPDFBuffer({
      quotationNumber: quote.correlative || quote.id,
      clientName: quote.customer?.name || quote.clientName || 'CLIENTE ESTIMADO',
      clientTaxId: quote.customer?.taxId || quote.clientTaxId,
      clientPhone: quote.customer?.phone || quote.clientPhone,
      clientEmail: quote.customer?.email || quote.clientEmail,
      destinationCity: quote.customer?.city || quote.destinationCity,
      projectName: 'Inversiones Lucem C.A. / Grupo Aludra',
      tasaBCV,
      tasaParalelo: Number(quote.rates?.paralelo || undefined),
      tasaEUR: Number(quote.rates?.eur || undefined),
      items: (quote.items || []).map((it: any) => ({
        sku: it.sku,
        name: it.name,
        quantity: Number(it.quantity || 1),
        unit: it.unit || 'UNIDAD',
        unitPrice: Number(it.unitPriceUSD || it.unitPrice || 0),
        priceList: Number(it.unitPriceUSD || it.unitPrice || 0),
        medidas: it.medidas,
        empaqueCantidad: it.empaqueCantidad,
        notes: it.notes
      })),
      notes: quote.notes
    });

    const filename = quotationNumber + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    return res.send(buffer);
  } catch (error: any) {
    console.error('Error visualizando PDF de cotización:', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};
