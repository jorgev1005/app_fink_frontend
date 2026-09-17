import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import { updateAccountBalance } from '../services/account.service';
import { getLatestExchangeRate } from '../services/exchangeRate.service';
import { checkProjectWriteAccess, getProjectAccessFilter } from '../utils/projectAccess';
import { calculateInvoiceProfitability } from '../services/profitability.service';

export async function getNextInvoiceCode(projectId: string, isDeliveryNote: boolean = false): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { lastInvoiceNumber: true, lastDeliveryNoteNumber: true }
  });

  let candidate = '';

  if (isDeliveryNote) {
    // 1. NOTA DE ENTREGA: Prefijo garantizado NE- y formato NE-0001
    const lastSaved = project?.lastDeliveryNoteNumber?.trim();
    if (lastSaved && /NE-?\d+/i.test(lastSaved)) {
      const match = lastSaved.match(/(\d+)$/);
      if (match) {
        const numStr = match[1];
        const nextVal = parseInt(numStr, 10) + 1;
        const padLength = Math.max(numStr.length, 4);
        candidate = `NE-${String(nextVal).padStart(padLength, '0')}`;
      }
    }

    if (!candidate) {
      // Buscar en BD la nota de entrega más alta de este proyecto
      const lastNEs = await prisma.invoice.findMany({
        where: {
          projectId,
          type: 'INVOICE',
          code: { startsWith: 'NE' }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      let maxNum = 0;
      let maxPad = 4;
      for (const inv of lastNEs) {
        const m = inv.code.trim().match(/(\d+)$/);
        if (m) {
          const val = parseInt(m[1], 10);
          if (val > maxNum) {
            maxNum = val;
            maxPad = Math.max(m[1].length, 4);
          }
        }
      }

      if (maxNum > 0) {
        candidate = `NE-${String(maxNum + 1).padStart(maxPad, '0')}`;
      } else {
        candidate = 'NE-0001';
      }
    }

    // Asegurar unicidad global en la tabla invoices
    while (await prisma.invoice.findUnique({ where: { code: candidate } })) {
      const match = candidate.match(/(\d+)$/);
      if (match) {
        const numStr = match[1];
        const nextVal = parseInt(numStr, 10) + 1;
        const padLength = Math.max(numStr.length, 4);
        candidate = `NE-${String(nextVal).padStart(padLength, '0')}`;
      } else {
        candidate = `${candidate}-${Date.now()}`;
      }
    }
  } else {
    // 2. FACTURA DE VENTA: Correlativo numérico independiente (ej: 0204)
    const lastSaved = project?.lastInvoiceNumber?.trim();
    // Descartar si por error se guardó un código con prefijo NE o POS
    if (lastSaved && !/^NE/i.test(lastSaved) && !/^POS/i.test(lastSaved)) {
      const match = lastSaved.match(/(\d+)$/);
      if (match) {
        const numStr = match[1];
        const nextVal = parseInt(numStr, 10) + 1;
        const padLength = Math.max(numStr.length, 4);
        const prefix = lastSaved.substring(0, lastSaved.length - numStr.length);
        candidate = `${prefix}${String(nextVal).padStart(padLength, '0')}`;
      }
    }

    if (!candidate) {
      // Buscar en BD las facturas de venta (excluyendo notas de entrega y ventas POS)
      const lastInvoices = await prisma.invoice.findMany({
        where: {
          projectId,
          type: 'INVOICE',
          AND: [
            { code: { not: { startsWith: 'NE' } } },
            { code: { not: { startsWith: 'POS-' } } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      let maxNum = 0;
      let maxPad = 4;
      let detectedPrefix = '';
      for (const inv of lastInvoices) {
        const clean = inv.code.trim();
        const m = clean.match(/(\d+)$/);
        if (m) {
          const val = parseInt(m[1], 10);
          if (val > maxNum) {
            maxNum = val;
            maxPad = Math.max(m[1].length, 4);
            detectedPrefix = clean.substring(0, clean.length - m[1].length);
          }
        }
      }

      if (maxNum > 0) {
        candidate = `${detectedPrefix}${String(maxNum + 1).padStart(maxPad, '0')}`;
      } else {
        candidate = '0001';
      }
    }

    // Asegurar unicidad global en la tabla invoices
    while (await prisma.invoice.findUnique({ where: { code: candidate } })) {
      const match = candidate.match(/(\d+)$/);
      if (match) {
        const numStr = match[1];
        const nextVal = parseInt(numStr, 10) + 1;
        const padLength = Math.max(numStr.length, 4);
        const prefix = candidate.substring(0, candidate.length - numStr.length);
        candidate = `${prefix}${String(nextVal).padStart(padLength, '0')}`;
      } else {
        candidate = `${candidate}-${Date.now()}`;
      }
    }
  }

  return candidate;
}

// GET /api/invoices/next-code?projectId=xxx&isDeliveryNote=true
export const getNextInvoiceCodeEndpoint = async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string;
    const isDeliveryNote = req.query.isDeliveryNote === 'true' || req.query.isDeliveryNote === '1';

    if (!projectId) {
      return res.status(400).json({ success: false, error: { message: 'projectId es requerido' } });
    }

    const nextCode = await getNextInvoiceCode(projectId, isDeliveryNote);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { lastInvoiceNumber: true, lastDeliveryNoteNumber: true }
    });

    return res.json({
      success: true,
      data: {
        nextCode,
        lastCode: isDeliveryNote ? project?.lastDeliveryNoteNumber : project?.lastInvoiceNumber,
        isDeliveryNote
      }
    });
  } catch (error: any) {
    console.error('Error al obtener siguiente código de factura/nota:', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const createInvoice = async (req: Request, res: Response) => {
  try {
    const { 
      projectId, type, issueDate, dueDate, currency, total, code,
      vendorId, customerId, description, taxAmount,
      isPaid, paymentAccountId, paymentMethod, paymentReference, lines,
      status, isDeliveryNote, isPurchaseOrder, purchaseOrder, purchaseOrderDate, notes
    } = req.body;
    
    const user = (req as any).user;
    if (!projectId) return res.status(400).json({ success: false, error: { message: 'projectId required' } });
    if (!total || Number(total) <= 0) return res.status(400).json({ success: false, error: { message: 'total must be > 0' } });

    const hasAccess = await checkProjectWriteAccess(user, projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para crear facturas en este proyecto' } });
    }

    // Validate Contact
    if (type === 'BILL' && !vendorId) {
        return res.status(400).json({ success: false, error: { message: 'El proveedor es obligatorio para compras u órdenes de compra' } });
    }
    if (type === 'INVOICE' && !customerId) {
        return res.status(400).json({ success: false, error: { message: 'El cliente es obligatorio para facturas de venta' } });
    }

    let invoiceCode = code ? String(code).trim() : '';
    if (!invoiceCode) {
      if (type === 'INVOICE') {
        invoiceCode = await getNextInvoiceCode(projectId, !!isDeliveryNote);
      } else if (isPurchaseOrder) {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const rand = Math.floor(Math.random() * 9000) + 1000;
        invoiceCode = `OC-${year}${month}${day}-${rand}`;
      } else {
        invoiceCode = `BILL-${projectId.substring(0, 4).toUpperCase()}-${Date.now()}`;
      }
    }

    // Ensure strict uniqueness in database before creating
    let checkAttempts = 0;
    while (await prisma.invoice.findUnique({ where: { code: invoiceCode } })) {
      checkAttempts++;
      const match = invoiceCode.match(/(\d+)$/);
      if (match) {
        const numStr = match[1];
        const nextVal = parseInt(numStr, 10) + checkAttempts;
        const paddedNumStr = String(nextVal).padStart(numStr.length, '0');
        const prefix = invoiceCode.substring(0, invoiceCode.length - numStr.length);
        invoiceCode = `${prefix}${paddedNumStr}`;
      } else {
        invoiceCode = `${invoiceCode}-${Date.now()}`;
      }
    }

    // Anchor dueDate to noon if it's a date-only string
    let dueDateToStore = dueDate;
    if (dueDate && typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      dueDateToStore = dueDate + 'T12:00:00';
    }

    // Anchor issueDate to noon if it's a date-only string to prevent TZ shifts
    let issueDateToStore = issueDate ? new Date(issueDate) : new Date();
    if (issueDate && typeof issueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
        issueDateToStore = new Date(issueDate + 'T12:00:00');
    }

    // Prepare Lines Data (JSON)
    // We strictly use an object wrapper now to ensure metadata (tax, description) is kept along with items
    let finalLinesData: any = {
      items: [],
      taxAmount: Number(taxAmount) || 0,
      description: description || ''
    };

    if (Array.isArray(lines)) {
      finalLinesData.items = lines;
    } else if (lines) {
      // If legacy lines was passed as object (unlikely from new frontend)
      // or if we fall back to just description/tax
      // We already set defaults above.
      // If lines was null, we just have empty items.
    }

    // fallback for legacy structure support in case we are editing old invoices? 
    // New create always uses this structure.

    const targetStatus = status || (isPaid ? 'PAID' : 'OPEN');

    // Transactional creation if payment is involved
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Invoice
      const createdInvoice = await tx.invoice.create({
        data: {
          project: { connect: { id: projectId } },
          code: invoiceCode,
          type: type || 'BILL',
          vendorId: vendorId || null,
          customerId: customerId || null,
          issueDate: issueDateToStore,
          dueDate: dueDateToStore ? new Date(dueDateToStore) : undefined,
          currency,
          total: Number(total),
          outstanding: isPaid ? 0 : Number(total), // If fully paid, outstanding is 0
          status: targetStatus,
          lines: JSON.stringify(finalLinesData), // Store consistent object structure
          createdBy: user.id,
          purchaseOrder: purchaseOrder || null,
          purchaseOrderDate: purchaseOrderDate || null,
          notes: notes || null,
        }
      });

      // Update Project general settings sequence numbers de forma estrictamente independiente
      if (type === 'INVOICE') {
        const isActuallyDeliveryNote = invoiceCode.toUpperCase().startsWith('NE') || !!isDeliveryNote;
        if (isActuallyDeliveryNote) {
          await tx.project.update({
            where: { id: projectId },
            data: { lastDeliveryNoteNumber: invoiceCode }
          });
        } else {
          await tx.project.update({
            where: { id: projectId },
            data: { lastInvoiceNumber: invoiceCode }
          });
        }
      }
      
      // 1.5 Process Inventory Updates checks
      if (targetStatus !== 'DRAFT' && finalLinesData.items && finalLinesData.items.length > 0) {
          for (const line of finalLinesData.items) {
              if (line.productId && line.productId !== 'CUSTOM' && line.quantity) {
                  const qty = Number(line.quantity);
                  // BILL (Compra) -> Aumenta Stock (+)
                  // INVOICE (Venta) -> Disminuye Stock (-)
                  const operationMultiplier = (type === 'BILL') ? 1 : -1;
                  
                  await tx.product.update({
                      where: { id: line.productId },
                      data: {
                          stock: { increment: qty * operationMultiplier },
                      }
                  });
              }
          }
      }

      // 2. Create Payment if requested

      // 2. Create Payment if requested
      if (isPaid && paymentAccountId) {
        const paymentCode = `PAY-${Date.now()}`;
        const createdPayment = await tx.payment.create({
          data: {
            projectId,
            code: paymentCode,
            date: new Date(), // Payment date is now
            currency, // Assuming payment in same currency for simplicity
            amount: Number(total),
            method: paymentMethod || 'OTHER',
            reference: paymentReference || null,
            status: 'COMPLETED',
            userId: user.id,
            accountId: paymentAccountId,
            exchangeRate: 1 // base
          }
        });

        // 3. Create Allocation
        await tx.paymentAllocation.create({
          data: {
            paymentId: createdPayment.id,
            invoiceId: createdInvoice.id,
            allocatedAmount: Number(total)
          }
        });

        // 4. Update Account Balance (If account exists) via logic
        // We need to fetch account to know current balance, update it.
        // Simplified: We call the service helper later or do raw update here.
        // For safety/speed in this tool usage, I'll do raw update if account is managed.
        // But better to rely on `updateAccountBalance` service if imported. 
        // Since `updateAccountBalance` is imported at top file, I can use it AFTER transaction or inside?
        // `updateAccountBalance` uses prisma internally. It might not be transaction-aware if it uses global prisma.
        // So I will just let the user know balance might update async or handle it simply.
        // Directly call: await updateAccountBalance(paymentAccountId);
      }

      if (targetStatus === 'PAID') {
        await calculateInvoiceProfitability(createdInvoice.id, tx);
      }

      return createdInvoice;
    });
    
    // Trigger balance update outside transaction (to use global prisma instance of the service)
    if (isPaid && paymentAccountId && updateAccountBalance) {
        const operation = (type === 'INVOICE') ? 'DEBIT' : 'CREDIT'; // INVOICE = Venta (Entrada/Debit), BILL = Compra (Salida/Credit)
        try { 
            await updateAccountBalance(
                paymentAccountId, 
                currency, 
                Number(total), 
                operation
            ); 
        } catch(e) { console.error('Error updating balance:', e); }
    }

    // Si la factura/nota proviene de una cotización (COT-...), actualizar el estado de la cotización a INVOICED
    if (purchaseOrder && typeof purchaseOrder === 'string' && purchaseOrder.startsWith('COT-')) {
      try {
        const root = process.cwd();
        const paths = [
          path.join(root, 'data', 'cotizaciones_historial.json'),
          path.join(root, 'uploads', 'cotizaciones_historial.json'),
          path.join(root, '..', 'data', 'cotizaciones_historial.json'),
          path.join('/home/fink', 'cotizaciones_historial.json'),
          path.join('/home/fink/app_fink', 'cotizaciones_historial.json'),
          path.join('/home/fink/app_fink/backend/data', 'cotizaciones_historial.json'),
          path.join('/home/fink/asistente', 'cotizaciones_historial.json')
        ];
        paths.forEach(filePath => {
          if (fs.existsSync(filePath)) {
            try {
              const list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              if (Array.isArray(list)) {
                const qIdx = list.findIndex((q: any) => q && (q.id === purchaseOrder || q.correlative === purchaseOrder));
                if (qIdx >= 0) {
                  list[qIdx].status = 'INVOICED';
                  list[qIdx].invoiceCode = result.code;
                  list[qIdx].invoiceId = result.id;
                  list[qIdx].invoicedAt = new Date().toISOString();
                  fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');
                  console.log(`[FINK] Cotización ${purchaseOrder} vinculada a documento ${result.code}`);
                }
              }
            } catch (_) {}
          }
        });
      } catch (e) {
        console.warn('Error updating quotation to INVOICED:', e);
      }
    }

    // === LOG DE ACTIVIDAD ===
    try {
      const { logActivity } = await import('../services/activityLog.service');
      await logActivity(
        user.id,
        'CREATE',
        'Invoice',
        result.id,
        `Creación de factura ${result.code} ${isPaid ? '(Pagada)' : ''}`,
        {
          total: result.total,
          currency: result.currency,
          type: result.type,
          projectId: result.projectId,
          vendorId, 
          customerId
        },
        req.ip,
        req.headers['user-agent'] as string
      );
    } catch (err) {
      console.error('Error registrando log de actividad (createInvoice):', err);
    }

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    console.error('[createInvoice] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const issueInvoiceFromDeliveryNote = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const { customCode, issueDate, dueDate, notes: additionalNotes } = req.body;

    const deliveryNote = await prisma.invoice.findUnique({
      where: { id },
      include: {
        payments: true,
        project: true
      }
    });

    if (!deliveryNote) {
      return res.status(404).json({ success: false, error: { message: 'Nota de Entrega no encontrada' } });
    }

    const hasAccess = await checkProjectWriteAccess(user, deliveryNote.projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para emitir facturas en este proyecto' } });
    }

    // Validar que sea una Nota de Entrega
    const isNE = deliveryNote.code.toUpperCase().startsWith('NE');
    if (!isNE) {
      return res.status(400).json({ success: false, error: { message: 'Solo se pueden facturar documentos que sean Notas de Entrega (NE)' } });
    }

    // Parsear líneas de la nota de entrega
    let parsedLines: any = { items: [], taxAmount: 0, description: '' };
    try {
      if (deliveryNote.lines) {
        parsedLines = typeof deliveryNote.lines === 'string' ? JSON.parse(deliveryNote.lines) : deliveryNote.lines;
        if (Array.isArray(parsedLines)) {
          parsedLines = { items: parsedLines, taxAmount: 0, description: '' };
        }
      }
    } catch (e) {
      console.error('Error parseando líneas de NE:', e);
    }

    // Verificar si ya fue facturada y la factura aún existe
    if (parsedLines.invoicedAsId) {
      const existingInvoice = await prisma.invoice.findUnique({ where: { id: parsedLines.invoicedAsId } });
      if (existingInvoice) {
        return res.status(400).json({
          success: false,
          error: { message: `Esta Nota de Entrega ya fue facturada bajo la Factura #${existingInvoice.code}` }
        });
      }
    }

    // Determinar correlativo de la nueva Factura oficial e independiente
    let invoiceCode = customCode ? String(customCode).trim() : '';
    if (!invoiceCode) {
      invoiceCode = await getNextInvoiceCode(deliveryNote.projectId, false);
    }

    // Asegurar unicidad global del código en la tabla invoices
    let attempts = 0;
    while (await prisma.invoice.findUnique({ where: { code: invoiceCode } })) {
      attempts++;
      const match = invoiceCode.match(/(\d+)$/);
      if (match) {
        const numStr = match[1];
        const nextVal = parseInt(numStr, 10) + attempts;
        const paddedNumStr = String(nextVal).padStart(numStr.length, '0');
        const prefix = invoiceCode.substring(0, invoiceCode.length - numStr.length);
        invoiceCode = `${prefix}${paddedNumStr}`;
      } else {
        invoiceCode = `${invoiceCode}-${Date.now()}`;
      }
    }

    // Fechas
    const issueDateToStore = issueDate ? new Date(issueDate) : new Date();
    const dueDateToStore = dueDate ? new Date(dueDate) : (deliveryNote.dueDate ? new Date(deliveryNote.dueDate) : null);

    // Preparar objeto de líneas para la nueva Factura (marcado para no descontar inventario duplicado)
    const newInvoiceLines: any = {
      items: parsedLines.items || [],
      taxAmount: parsedLines.taxAmount || 0,
      description: parsedLines.description || '',
      sourceDeliveryNoteId: deliveryNote.id,
      sourceDeliveryNoteCode: deliveryNote.code,
      skipInventoryDeduction: true,
      issuedFromDeliveryNoteAt: new Date().toISOString()
    };

    // Notas cruzadas de trazabilidad
    const refText = `Despacho amparado bajo Nota de Entrega ${deliveryNote.code}`;
    const cleanNotes = [deliveryNote.notes, refText, additionalNotes].filter(Boolean).join(' | ');

    // Cuentas por cobrar: transferir allocations si la NE ya tenía abonos
    const hasPayments = deliveryNote.payments && deliveryNote.payments.length > 0;
    const targetStatus = hasPayments ? deliveryNote.status : (deliveryNote.status === 'DRAFT' ? 'OPEN' : deliveryNote.status);
    const targetOutstanding = hasPayments ? deliveryNote.outstanding : deliveryNote.total;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear Factura Oficial (SIN descontar inventario, pues ya lo descontó la NE)
      const createdInvoice = await tx.invoice.create({
        data: {
          project: { connect: { id: deliveryNote.projectId } },
          code: invoiceCode,
          type: 'INVOICE',
          vendorId: null,
          customerId: deliveryNote.customerId,
          issueDate: issueDateToStore,
          dueDate: dueDateToStore,
          currency: deliveryNote.currency,
          total: Number(deliveryNote.total),
          outstanding: Number(targetOutstanding),
          status: targetStatus,
          lines: JSON.stringify(newInvoiceLines),
          totalCost: deliveryNote.totalCost || 0,
          netProfit: deliveryNote.netProfit || 0,
          createdBy: user.id,
          purchaseOrder: deliveryNote.purchaseOrder || deliveryNote.code,
          purchaseOrderDate: deliveryNote.purchaseOrderDate || null,
          notes: cleanNotes
        }
      });

      // 2. Transferir pagos/abonos de la Nota de Entrega a la Factura (si existen)
      if (hasPayments) {
        await tx.paymentAllocation.updateMany({
          where: { invoiceId: deliveryNote.id },
          data: { invoiceId: createdInvoice.id }
        });
      }

      // 3. Actualizar Nota de Entrega: vincular a la Factura, saldo en 0 y marcar como facturada
      const updatedNELines = {
        ...parsedLines,
        invoicedAsId: createdInvoice.id,
        invoicedAsCode: createdInvoice.code,
        invoicedAt: new Date().toISOString()
      };

      const neNotes = [deliveryNote.notes, `Facturado bajo Factura #${createdInvoice.code}`].filter(Boolean).join(' | ');

      await tx.invoice.update({
        where: { id: deliveryNote.id },
        data: {
          lines: JSON.stringify(updatedNELines),
          outstanding: 0,
          status: 'PAID', // Saldo transferido y cubierto por la Factura formal
          notes: neNotes
        }
      });

      // 4. Actualizar correlativo de Factura en el proyecto
      await tx.project.update({
        where: { id: deliveryNote.projectId },
        data: { lastInvoiceNumber: invoiceCode }
      });

      return createdInvoice;
    });

    // Registrar log de actividad
    try {
      const { logActivity } = await import('../services/activityLog.service');
      await logActivity(
        user.id,
        'CREATE',
        'Invoice',
        result.id,
        `Emisión de Factura ${result.code} a partir de Nota de Entrega ${deliveryNote.code}`,
        {
          sourceDeliveryNoteId: deliveryNote.id,
          sourceDeliveryNoteCode: deliveryNote.code,
          invoiceCode: result.code,
          total: result.total,
          currency: result.currency,
          projectId: deliveryNote.projectId,
          customerId: deliveryNote.customerId
        },
        req.ip,
        req.headers['user-agent'] as string
      );
    } catch (err) {
      console.error('Error registrando log de actividad (issueInvoiceFromDeliveryNote):', err);
    }

    return res.status(201).json({
      success: true,
      data: result,
      message: `Factura ${result.code} emitida exitosamente a partir de Nota de Entrega ${deliveryNote.code}`
    });
  } catch (error: any) {
    console.error('[issueInvoiceFromDeliveryNote] error', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const convertPurchaseOrderToBill = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const { supplierInvoiceCode, issueDate, dueDate, notes: additionalNotes } = req.body;

    if (!supplierInvoiceCode || !String(supplierInvoiceCode).trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'El número de factura / control del proveedor es obligatorio' }
      });
    }

    const cleanInvoiceCode = String(supplierInvoiceCode).trim();

    const po = await prisma.invoice.findUnique({
      where: { id },
      include: {
        payments: true,
        project: true
      }
    });

    if (!po) {
      return res.status(404).json({ success: false, error: { message: 'Orden de Compra no encontrada' } });
    }

    const hasAccess = await checkProjectWriteAccess(user, po.projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para registrar facturas en este proyecto' } });
    }

    // Validar que sea una Orden de Compra (OC-... o type === 'BILL' con código OC)
    const isOC = po.code.toUpperCase().startsWith('OC-') || (po.type === 'BILL' && po.code.toUpperCase().startsWith('OC'));
    if (!isOC && po.type !== 'BILL') {
      return res.status(400).json({ success: false, error: { message: 'Solo se pueden convertir documentos que sean Órdenes de Compra (OC)' } });
    }

    // Parsear líneas de la orden de compra
    let parsedLines: any = { items: [], taxAmount: 0, description: '' };
    try {
      if (po.lines) {
        parsedLines = typeof po.lines === 'string' ? JSON.parse(po.lines) : po.lines;
        if (Array.isArray(parsedLines)) {
          parsedLines = { items: parsedLines, taxAmount: 0, description: '' };
        }
      }
    } catch (e) {
      console.error('Error parseando líneas de OC:', e);
    }

    // Verificar si ya fue convertida y la factura aún existe
    const existingBillId = parsedLines.convertedToBillId || parsedLines.invoicedAsId;
    if (existingBillId) {
      const existingBill = await prisma.invoice.findUnique({ where: { id: existingBillId } });
      if (existingBill) {
        return res.status(400).json({
          success: false,
          error: { message: `Esta Orden de Compra ya fue convertida bajo la Factura de Proveedor #${existingBill.code}` }
        });
      }
    }

    // Comprobar si el código de factura ya existe en el sistema
    const codeConflict = await prisma.invoice.findUnique({ where: { code: cleanInvoiceCode } });
    if (codeConflict) {
      return res.status(400).json({
        success: false,
        error: { message: `Ya existe una factura o documento registrado con el código "${cleanInvoiceCode}". Usa un número único.` }
      });
    }

    // Fechas
    let issueDateToStore = issueDate ? new Date(issueDate) : new Date();
    if (issueDate && typeof issueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
      issueDateToStore = new Date(issueDate + 'T12:00:00');
    }

    let dueDateToStore: Date | null = null;
    if (dueDate) {
      dueDateToStore = typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
        ? new Date(dueDate + 'T12:00:00')
        : new Date(dueDate);
    } else if (po.dueDate) {
      dueDateToStore = new Date(po.dueDate);
    }

    // Preparar objeto de líneas para la nueva Factura de Proveedor
    const newBillLines: any = {
      items: parsedLines.items || [],
      taxAmount: parsedLines.taxAmount || 0,
      description: parsedLines.description || '',
      sourcePurchaseOrderId: po.id,
      sourcePurchaseOrderCode: po.code,
      skipInventoryIncrement: true, // No duplicar inventario ya que la OC lo administró
      convertedFromPOAt: new Date().toISOString()
    };

    // Notas de trazabilidad
    const refText = `Factura de compra generada a partir de Orden de Compra ${po.code}`;
    const cleanNotes = [po.notes, refText, additionalNotes].filter(Boolean).join(' | ');

    // Cuentas por pagar: transferir abonos si la OC ya tenía pagos/anticipos
    const hasPayments = po.payments && po.payments.length > 0;
    const targetStatus = hasPayments ? po.status : (po.status === 'DRAFT' ? 'OPEN' : po.status);
    const targetOutstanding = hasPayments ? po.outstanding : po.total;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear Factura de Proveedor (BILL)
      const createdBill = await tx.invoice.create({
        data: {
          project: { connect: { id: po.projectId } },
          code: cleanInvoiceCode,
          type: 'BILL',
          vendorId: po.vendorId,
          customerId: null,
          issueDate: issueDateToStore,
          dueDate: dueDateToStore,
          currency: po.currency,
          total: Number(po.total),
          outstanding: Number(targetOutstanding),
          status: targetStatus,
          lines: JSON.stringify(newBillLines),
          totalCost: po.totalCost || Number(po.total),
          netProfit: 0,
          createdBy: user.id,
          purchaseOrder: po.code,
          purchaseOrderDate: po.issueDate ? po.issueDate.toISOString().split('T')[0] : (po.purchaseOrderDate || null),
          notes: cleanNotes
        }
      });

      // 2. Transferir abonos/pagos de la OC a la nueva Factura de Proveedor (si existen)
      if (hasPayments) {
        await tx.paymentAllocation.updateMany({
          where: { invoiceId: po.id },
          data: { invoiceId: createdBill.id }
        });
      }

      // 3. Actualizar la OC original: vincular a la Factura, saldo en 0 y marcar como facturada/completada
      const updatedPOLines = {
        ...parsedLines,
        convertedToBillId: createdBill.id,
        convertedToBillCode: createdBill.code,
        invoicedAsId: createdBill.id,
        invoicedAsCode: createdBill.code,
        convertedAt: new Date().toISOString()
      };

      const poNotes = [po.notes, `Facturado bajo Factura de Proveedor #${createdBill.code}`].filter(Boolean).join(' | ');

      await tx.invoice.update({
        where: { id: po.id },
        data: {
          lines: JSON.stringify(updatedPOLines),
          outstanding: 0,
          status: 'PAID', // Saldo transferido y cubierto por la Factura formal
          notes: poNotes
        }
      });

      return createdBill;
    });

    // Registrar log de actividad
    try {
      const { logActivity } = await import('../services/activityLog.service');
      await logActivity(
        user.id,
        'CREATE',
        'Invoice',
        result.id,
        `Conversión de Orden de Compra ${po.code} a Factura de Proveedor ${result.code}`,
        {
          sourcePurchaseOrderId: po.id,
          sourcePurchaseOrderCode: po.code,
          billCode: result.code,
          total: result.total,
          currency: result.currency,
          projectId: po.projectId,
          vendorId: po.vendorId
        },
        req.ip,
        req.headers['user-agent'] as string
      );
    } catch (err) {
      console.error('Error registrando log de actividad (convertPurchaseOrderToBill):', err);
    }

    return res.status(201).json({
      success: true,
      data: result,
      message: `Factura de Proveedor #${result.code} creada exitosamente a partir de la Orden de Compra ${po.code}`
    });
  } catch (error: any) {
    console.error('[convertPurchaseOrderToBill] error', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const updateDispatchStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const { status, dispatchNotes } = req.body;

    const validStatuses = ['PENDING_DISPATCH', 'DISPATCHED', 'DELIVERED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { message: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}` }
      });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return res.status(404).json({ success: false, error: { message: 'Documento no encontrado' } });
    }

    const hasAccess = await checkProjectWriteAccess(user, invoice.projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para modificar este documento' } });
    }

    let parsedLines: any = {};
    try {
      if (invoice.lines) {
        parsedLines = typeof invoice.lines === 'string' ? JSON.parse(invoice.lines) : invoice.lines;
        if (Array.isArray(parsedLines)) {
          parsedLines = { items: parsedLines };
        }
      }
    } catch (e) {
      parsedLines = { items: [] };
    }

    const nowIso = new Date().toISOString();
    parsedLines.dispatchStatus = status;

    if (status === 'DISPATCHED') {
      if (!parsedLines.dispatchedAt) parsedLines.dispatchedAt = nowIso;
    } else if (status === 'DELIVERED') {
      if (!parsedLines.dispatchedAt) parsedLines.dispatchedAt = nowIso;
      parsedLines.deliveredAt = nowIso;
    } else if (status === 'PENDING_DISPATCH') {
      parsedLines.dispatchedAt = null;
      parsedLines.deliveredAt = null;
    }

    if (dispatchNotes !== undefined) {
      parsedLines.dispatchNotes = dispatchNotes;
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        lines: JSON.stringify(parsedLines)
      }
    });

    try {
      const { logActivity } = await import('../services/activityLog.service');
      await logActivity(
        user.id,
        'UPDATE',
        'Invoice',
        invoice.id,
        `Actualización de estado logístico en ${invoice.code} a ${status}`,
        {
          previousStatus: parsedLines.dispatchStatus,
          newStatus: status,
          dispatchNotes
        },
        req.ip,
        req.headers['user-agent'] as string
      );
    } catch (err) {
      console.error('Error registrando log de actividad (updateDispatchStatus):', err);
    }

    return res.json({
      success: true,
      data: {
        ...updated,
        dispatchStatus: parsedLines.dispatchStatus,
        dispatchedAt: parsedLines.dispatchedAt,
        deliveredAt: parsedLines.deliveredAt,
        dispatchNotes: parsedLines.dispatchNotes
      },
      message: `Estado de despacho actualizado a ${status}`
    });
  } catch (error: any) {
    console.error('[updateDispatchStatus] error', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const updateInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const { 
      projectId, type, issueDate, dueDate, currency, total, code,
      vendorId, customerId, description, taxAmount, lines, status,
      purchaseOrder, purchaseOrderDate
    } = req.body;
    
    // Check existence and status
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ success: false, error: { message: 'Invoice not found' } });

    const hasAccess = await checkProjectWriteAccess(user, invoice.projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para modificar facturas en este proyecto' } });
    }
    
    // Only allow editing if not paid
    if (invoice.status === 'PAID' || invoice.status === 'PARTIALLY_PAID') {
        return res.status(400).json({ success: false, error: { message: 'No se puede editar una factura pagada o parcialmente pagada.' } });
    }

    // Anchor dueDate to noon if it's a date-only string
    let dueDateToStore = dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : invoice.dueDate;
    if (dueDate && typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      dueDateToStore = new Date(dueDate + 'T12:00:00');
    }

    // Anchor issueDate to noon if it's a date-only string to prevent TZ shifts
    let issueDateToStore = issueDate ? new Date(issueDate) : invoice.issueDate;
    if (issueDate && typeof issueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
      issueDateToStore = new Date(issueDate + 'T12:00:00');
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Get old items from lines
      let oldItems: any[] = [];
      let oldDescription = '';
      let oldTaxAmount = 0;
      try {
        if (invoice.lines) {
          const parsed = typeof invoice.lines === 'string' ? JSON.parse(invoice.lines) : invoice.lines;
          if (parsed) {
            if (Array.isArray(parsed)) {
              oldItems = parsed;
            } else if (typeof parsed === 'object') {
              if (parsed.items && Array.isArray(parsed.items)) {
                oldItems = parsed.items;
              }
              oldDescription = parsed.description || '';
              oldTaxAmount = Number(parsed.taxAmount || 0);
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse old lines', e);
      }

      // 2. Get new items from request if provided
      let newItems = oldItems; // Default to old items if not provided
      if (lines !== undefined) {
        if (Array.isArray(lines)) {
          newItems = lines;
        } else if (lines && lines.items && Array.isArray(lines.items)) {
          newItems = lines.items;
        }
      }

      // 3. Revert old stock changes
      if (invoice.status !== 'DRAFT' && oldItems.length > 0) {
        for (const line of oldItems) {
          if (line.productId && line.productId !== 'CUSTOM' && line.quantity) {
            const qty = Number(line.quantity);
            // Reverse of BILL (+stock) is -qty
            // Reverse of INVOICE (-stock) is +qty
            const operationMultiplier = (invoice.type === 'BILL') ? -1 : 1;
            
            await tx.product.update({
              where: { id: line.productId },
              data: {
                stock: { increment: qty * operationMultiplier }
              }
            });
          }
        }
      }

      // 4. Apply new stock changes (using new type)
      const targetStatus = status || invoice.status;
      const targetType = type || invoice.type;
      if (targetStatus !== 'DRAFT' && newItems.length > 0) {
        for (const line of newItems) {
          if (line.productId && line.productId !== 'CUSTOM' && line.quantity) {
            const qty = Number(line.quantity);
            // BILL (+stock)
            // INVOICE (-stock)
            const operationMultiplier = (targetType === 'BILL') ? 1 : -1;
            
            await tx.product.update({
              where: { id: line.productId },
              data: {
                stock: { increment: qty * operationMultiplier }
              }
            });
          }
        }
      }

      // 5. Construct lines data to save (preserving structure)
      const finalLinesData = {
        items: newItems,
        description: description !== undefined ? description : oldDescription,
        taxAmount: taxAmount !== undefined ? Number(taxAmount) : oldTaxAmount,
      };

      // 6. Update Invoice in DB
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          projectId: projectId || invoice.projectId,
          code: code || invoice.code,
          type: targetType,
          issueDate: issueDateToStore,
          dueDate: dueDateToStore,
          currency: currency || invoice.currency,
          total: total !== undefined ? Number(total) : invoice.total,
          outstanding: total !== undefined ? Number(total) : invoice.outstanding,
          status: targetStatus,
          lines: JSON.stringify(finalLinesData),
          vendorId: vendorId !== undefined ? (vendorId || null) : invoice.vendorId,
          customerId: customerId !== undefined ? (customerId || null) : invoice.customerId,
          purchaseOrder: purchaseOrder !== undefined ? (purchaseOrder || null) : invoice.purchaseOrder,
          purchaseOrderDate: purchaseOrderDate !== undefined ? (purchaseOrderDate || null) : invoice.purchaseOrderDate,
        }
      });

      if (targetStatus === 'PAID') {
        await calculateInvoiceProfitability(updatedInvoice.id, tx);
      }

      return updatedInvoice;
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[updateInvoice] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const deleteInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ success: false, error: { message: 'Invoice not found' } });

    const hasAccess = await checkProjectWriteAccess(user, invoice.projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para eliminar facturas en este proyecto' } });
    }
    
    // Only allow deleting DRAFT, PENDING, OPEN, or POSTED invoices (if unpaid)
    if (invoice.status === 'PAID') {
      return res.status(400).json({ success: false, error: { message: 'Cannot delete paid invoice' } });
    }

    // Check if there are any payment allocations linked to this invoice
    const allocationsCount = await prisma.paymentAllocation.count({
      where: { invoiceId: id }
    });
    if (allocationsCount > 0) {
      return res.status(400).json({ success: false, error: { message: 'No se puede eliminar una factura con pagos registrados. Elimina los pagos primero.' } });
    }

    await prisma.$transaction(async (tx) => {
      // If invoice was POSTED, find and delete the associated transaction
      if (invoice.status === 'POSTED') {
        const assocTxns = await tx.transaction.findMany({
          where: {
            projectId: invoice.projectId,
            reference: invoice.code
          }
        });
        
        for (const txn of assocTxns) {
          // Revert account balances if the transaction entries changed them
          const entries = await tx.transactionEntry.findMany({
            where: { transactionId: txn.id },
            include: { debitAccount: true, creditAccount: true }
          });
          
          for (const entry of entries) {
            // Revert debit account balance
            if (entry.debitAccountId && Number(entry.debitAmount) > 0) {
              const acct = entry.debitAccount as any;
              const acctCurrency = acct?.currency || txn.currency;
              let amt = Number(entry.debitAmount);
              await updateAccountBalance(entry.debitAccountId, acctCurrency as any, Number(amt), 'CREDIT');
            }
            // Revert credit account balance
            if (entry.creditAccountId && Number(entry.creditAmount) > 0) {
              const acct = entry.creditAccount as any;
              const acctCurrency = acct?.currency || txn.currency;
              let amt = Number(entry.creditAmount);
              await updateAccountBalance(entry.creditAccountId, acctCurrency as any, Number(amt), 'DEBIT');
            }
          }
          
          // Delete transaction (which cascades to entries)
          await tx.transaction.delete({ where: { id: txn.id } });
        }
      }

      // 1. Revert stock changes (SOLO si no fue emitida desde una nota de entrega)
      let items: any[] = [];
      let isInvoiceFromDelivery = false;
      let sourceDeliveryNoteId: string | null = null;
      try {
        if (invoice.lines) {
          const parsed = typeof invoice.lines === 'string' ? JSON.parse(invoice.lines) : invoice.lines;
          if (parsed) {
            if (Array.isArray(parsed)) {
              items = parsed;
            } else if (parsed.items && Array.isArray(parsed.items)) {
              items = parsed.items;
              if (parsed.skipInventoryDeduction || parsed.sourceDeliveryNoteId) {
                isInvoiceFromDelivery = true;
                sourceDeliveryNoteId = parsed.sourceDeliveryNoteId || null;
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse invoice lines on delete', e);
      }

      if (invoice.status !== 'DRAFT' && items.length > 0 && !isInvoiceFromDelivery) {
        for (const line of items) {
          if (line.productId && line.productId !== 'CUSTOM' && line.quantity) {
            const qty = Number(line.quantity);
            // Reverse of BILL (+stock) is -qty
            // Reverse of INVOICE (-stock) is +qty
            const operationMultiplier = (invoice.type === 'BILL') ? -1 : 1;
            
            await tx.product.update({
              where: { id: line.productId },
              data: {
                stock: { increment: qty * operationMultiplier }
              }
            });
          }
        }
      }

      // Si la factura provenía de una nota de entrega, desvincularla para permitir volver a facturarla
      if (sourceDeliveryNoteId) {
        try {
          const sourceNE = await tx.invoice.findUnique({ where: { id: sourceDeliveryNoteId } });
          if (sourceNE && sourceNE.lines) {
            const neParsed = typeof sourceNE.lines === 'string' ? JSON.parse(sourceNE.lines) : sourceNE.lines;
            delete neParsed.invoicedAsId;
            delete neParsed.invoicedAsCode;
            delete neParsed.invoicedAt;
            await tx.invoice.update({
              where: { id: sourceDeliveryNoteId },
              data: {
                lines: JSON.stringify(neParsed),
                status: 'OPEN',
                outstanding: sourceNE.total
              }
            });
          }
        } catch (neErr) {
          console.error('Error desvinculando nota de entrega origen:', neErr);
        }
      }

      // 2. Unlink any loose references (loan charges, scheduled occurrences)
      await tx.loanCharge.updateMany({
        where: { invoiceId: id },
        data: { invoiceId: null }
      });
      await tx.scheduledOccurrence.updateMany({
        where: { invoiceId: id },
        data: { invoiceId: null }
      });

      // 3. Delete the invoice
      await tx.invoice.delete({ where: { id } });
    });

    // === LOG DE ACTIVIDAD ===
    try {
      const { logActivity } = await import('../services/activityLog.service');
      await logActivity(
        (req as any).user?.id || 'system',
        'DELETE',
        'Invoice',
        invoice.id,
        `Eliminación de factura ${invoice.code}`,
        {
          total: invoice.total,
          currency: invoice.currency,
          type: invoice.type,
          projectId: invoice.projectId
        },
        req.ip,
        req.headers['user-agent'] as string
      );
    } catch (err) {
      console.error('Error registrando log de actividad (deleteInvoice):', err);
    }

    res.json({ success: true, message: 'Invoice deleted' });
  } catch (error: any) {
    console.error('[deleteInvoice] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const { projectId, status, purchaseOrder, search, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const user = (req as any).user;
    const where: any = {
      ...getProjectAccessFilter(user)
    };
    if (projectId) where.projectId = projectId as string;
    if (status) where.status = status as string;
    if (purchaseOrder) where.purchaseOrder = purchaseOrder as string;
    if (search && typeof search === 'string') {
      const s = search.trim();
      where.OR = [
        { code: { contains: s, mode: 'insensitive' } },
        { purchaseOrder: { contains: s, mode: 'insensitive' } },
        { notes: { contains: s, mode: 'insensitive' } }
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: Number(limit) }),
      prisma.invoice.count({ where })
    ]);

    // Manual population of contacts (since relation is missing in Prisma schema)
    const contactIds = new Set<string>();
    invoices.forEach(inv => {
        if (inv.vendorId) contactIds.add(inv.vendorId);
        if (inv.customerId) contactIds.add(inv.customerId);
    });

    let contactMap = new Map();
    if (contactIds.size > 0) {
        const contacts = await prisma.contactPerson.findMany({
            where: { id: { in: Array.from(contactIds) } },
            select: { id: true, name: true, taxId: true }
        });
        contactMap = new Map(contacts.map(c => [c.id, c]));
    }

    // Manual population of projects
    const projectIds = new Set<string>();
    invoices.forEach(inv => {
        if (inv.projectId) projectIds.add(inv.projectId);
    });

    let projectMap = new Map();
    if (projectIds.size > 0) {
        const projects = await prisma.project.findMany({
            where: { id: { in: Array.from(projectIds) } },
            select: { id: true, name: true, code: true }
        });
        projectMap = new Map(projects.map(p => [p.id, p]));
    }

    const enrichedInvoices = invoices.map((inv: any) => {
      let meta: any = {};
      try {
        if (inv.lines) {
          const parsed = typeof inv.lines === 'string' ? JSON.parse(inv.lines) : inv.lines;
          if (parsed && typeof parsed === 'object') {
            meta = {
              dispatchStatus: parsed.dispatchStatus || (inv.code?.startsWith('NE') ? 'PENDING_DISPATCH' : undefined),
              invoicedAsCode: parsed.invoicedAsCode || undefined,
              invoicedAsId: parsed.invoicedAsId || undefined,
              sourceDeliveryNoteCode: parsed.sourceDeliveryNoteCode || undefined,
              sourceDeliveryNoteId: parsed.sourceDeliveryNoteId || undefined,
              returns: parsed.returns || [],
              hasReturns: Boolean(parsed.returns && parsed.returns.length > 0)
            };
          }
        }
      } catch (_) {}

      return {
        ...inv,
        vendor: inv.vendorId ? contactMap.get(inv.vendorId) : null,
        customer: inv.customerId ? contactMap.get(inv.customerId) : null,
        contact: inv.vendorId ? contactMap.get(inv.vendorId) : (inv.customerId ? contactMap.get(inv.customerId) : null),
        project: inv.projectId ? projectMap.get(inv.projectId) : null,
        ...meta
      };
    });

    res.json({ success: true, data: enrichedInvoices, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

import { processInvoicePosting } from '../services/invoice.service';

export const postInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const createdTxn = await processInvoicePosting(id, user.id);

    res.json({ success: true, data: createdTxn });
  } catch (error: any) {
    console.error('[postInvoice] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getInvoiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({ 
      where: { id },
      include: { 
        project: true,
        payments: {
          include: {
            payment: {
              include: {
                account: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    currency: true,
                  }
                },
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                },
                transaction: {
                  select: {
                    id: true,
                    code: true,
                    description: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (!invoice) return res.status(404).json({ success: false, error: { message: 'Invoice not found' } });
    
    const contactId = invoice.vendorId || invoice.customerId;
    let contact = null;
    if (contactId) {
        contact = await prisma.contactPerson.findUnique({
            where: { id: contactId }
        });
    }

    let parsedLinesData: any = {};
    try {
      if (invoice.lines) {
        parsedLinesData = typeof invoice.lines === 'string' ? JSON.parse(invoice.lines) : invoice.lines;
      }
    } catch (_) {}
    
    res.json({ 
      success: true, 
      data: {
        ...invoice,
        contact,
        dispatchStatus: parsedLinesData.dispatchStatus || (invoice.code?.startsWith('NE') ? 'PENDING_DISPATCH' : undefined),
        dispatchedAt: parsedLinesData.dispatchedAt || null,
        deliveredAt: parsedLinesData.deliveredAt || null,
        dispatchNotes: parsedLinesData.dispatchNotes || null,
        invoicedAsId: parsedLinesData.invoicedAsId || null,
        invoicedAsCode: parsedLinesData.invoicedAsCode || null,
        invoicedAt: parsedLinesData.invoicedAt || null,
        sourceDeliveryNoteId: parsedLinesData.sourceDeliveryNoteId || null,
        sourceDeliveryNoteCode: parsedLinesData.sourceDeliveryNoteCode || null,
        returns: parsedLinesData.returns || [],
        hasReturns: Boolean(parsedLinesData.returns && parsedLinesData.returns.length > 0)
      } 
    });
  } catch (error: any) {
    console.error('[getInvoiceById] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getInvoicePdf = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: { project: true }
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: { message: 'Factura no encontrada' } });
    }

    const isOC = invoice.code?.toUpperCase().startsWith('OC-') || invoice.type === 'BILL';
    const contactId = invoice.vendorId || invoice.customerId;
    const contact = contactId ? await prisma.contactPerson.findUnique({ where: { id: contactId } }) : null;

    // Resolver datos de empresa y logo desde el proyecto
    const resolveLogoPath = (logoUrl?: string | null): string | null => {
      if (!logoUrl) return null;
      const clean = logoUrl.startsWith('/') ? logoUrl.slice(1) : logoUrl;
      const candidates = [
        path.join(process.cwd(), clean),
        path.join(process.cwd(), 'uploads', path.basename(clean)),
        path.join(process.cwd(), 'backend', clean),
        path.join(process.cwd(), 'backend', 'uploads', path.basename(clean)),
        path.join(__dirname, '..', '..', clean),
        path.join('/home/fink/app_fink/backend', clean)
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) return p;
      }
      return null;
    };

    const logoPath = resolveLogoPath(invoice.project?.logoUrl) || undefined;

    let companyName = invoice.project?.name || 'Inversiones Lucem C.A.';
    let companyTaxId = 'J-40500250-6';
    let companyAddress = 'Ciudad de La Victoria, Estado Aragua, Venezuela';
    let companyPhone = '+58 412-271-1859';
    let companyEmail = 'admin@grupoaludra.com';

    if (invoice.project?.description) {
      const rawLines = invoice.project.description.split('\n').map(l => l.trim()).filter(Boolean);
      if (rawLines.length > 0) {
        companyName = rawLines[0];
        const addrLines: string[] = [];
        for (let i = 1; i < rawLines.length; i++) {
          const line = rawLines[i];
          if (/^[JVEGjveg]-?\d{8,9}(-\d)?/i.test(line)) {
            companyTaxId = line;
          } else if (/@/.test(line)) {
            companyEmail = line;
          } else if (/^(tel|telf|tel[eé]fono|tlf|cel|whatsapp)/i.test(line)) {
            companyPhone = line;
          } else {
            addrLines.push(line.replace(/^direcci[oó]n:\s*/i, ''));
          }
        }
        if (addrLines.length > 0) {
          companyAddress = addrLines.join(', ');
        }
      }
    }

    // Obtener tasa BCV reciente
    const bcvRate = await prisma.exchangeRate.findFirst({
      where: { source: 'BCV' },
      orderBy: { date: 'desc' },
    });
    const tasaBCV = bcvRate?.usdToBs || 832.48;

    let parsedLines: any = { items: [] };
    try {
      if (invoice.lines) {
        parsedLines = typeof invoice.lines === 'string' ? JSON.parse(invoice.lines) : invoice.lines;
      }
    } catch (_) {}

    const itemsList = Array.isArray(parsedLines) ? parsedLines : (parsedLines.items || []);

    // 1. NOTA DE ENTREGA (NE-...) O VISTA COMO NOTA DE ENTREGA
    const isDeliveryNote = invoice.code?.toUpperCase().startsWith('NE-') || invoice.code?.toUpperCase().startsWith('NE') || req.query.viewMode === 'DELIVERY_NOTE';
    if (isDeliveryNote) {
      const productIds = itemsList.map((i: any) => i.productId).filter(Boolean);
      let productMap: Record<string, any> = {};
      if (productIds.length > 0) {
        const dbProducts = await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, sku: true, name: true, empaqueCantidad: true, unidad_empaque: true }
        });
        dbProducts.forEach(p => { productMap[p.id] = p; });
      }

      // Parámetros de visualización: precios y moneda
      const showPrices = req.query.showPrices === 'true' || req.query.showPrices === '1';
      const targetCurrency = (req.query.currency as string)?.toUpperCase() === 'BS' ? 'BS' : 'USD';
      const invCurr = (invoice.currency || 'USD').toUpperCase();
      const rawExchangeRate = (invoice as any).exchangeRate;
      const conversionRate = rawExchangeRate && Number(rawExchangeRate) > 0 
        ? Number(rawExchangeRate) 
        : (Number(req.query.rate) || tasaBCV || 1);

      const enrichedItems = itemsList.map((it: any) => {
        const prod = it.productId ? productMap[it.productId] : null;
        const sku = it.sku || prod?.sku || '';
        const name = it.name || it.description || 'Producto';
        const qty = Number(it.quantity || 1);
        const empaqueCantidad = Number(it.empaqueCantidad || prod?.empaqueCantidad || 0);
        const unidadEmpaque = it.unidadEmpaque || it.unidad_empaque || prod?.unidad_empaque || '';

        // Precios base
        const rawUnitPrice = Number(it.unitPrice || it.price || 0);
        const rawTotal = Number(it.total || (rawUnitPrice * qty));

        // Conversión según la moneda solicitada para la Nota de Entrega
        let finalUnitPrice = rawUnitPrice;
        let finalTotal = rawTotal;

        if (targetCurrency === 'BS' && invCurr === 'USD') {
          finalUnitPrice = rawUnitPrice * conversionRate;
          finalTotal = rawTotal * conversionRate;
        } else if (targetCurrency === 'USD' && invCurr === 'BS') {
          finalUnitPrice = conversionRate > 0 ? rawUnitPrice / conversionRate : rawUnitPrice;
          finalTotal = conversionRate > 0 ? rawTotal / conversionRate : rawTotal;
        }

        return {
          sku,
          description: name,
          quantity: qty,
          unit: it.unit || 'UNIDAD',
          unitPrice: finalUnitPrice,
          total: finalTotal,
          empaqueCantidad,
          unidadEmpaque,
          notes: it.notes || ''
        };
      });

      const { generateDeliveryNotePDFBuffer } = require('../services/deliveryNotePdf.service');
      const { buffer, noteNumber } = await generateDeliveryNotePDFBuffer({
        noteNumber: invoice.code,
        clientName: contact?.name || (invoice as any).clientName || 'CLIENTE ESTIMADO',
        clientTaxId: contact?.taxId || '',
        clientPhone: contact?.phone || '',
        clientEmail: contact?.email || '',
        clientAddress: contact?.address || '',
        companyName,
        companyTaxId,
        companyAddress,
        companyPhone,
        companyEmail,
        logoPath,
        deliveryAddress: contact?.address || 'Almacén Principal / Transporte',
        issueDate: invoice.issueDate ? invoice.issueDate.toString() : undefined,
        tasaBCV,
        items: enrichedItems,
        showPrices,
        currency: targetCurrency,
        notes: invoice.notes || '',
        dispatchStatus: parsedLines.dispatchStatus || 'PENDING_DISPATCH',
        invoicedAsCode: parsedLines.invoicedAsCode || undefined
      });

      const filename = `Nota_Entrega_${noteNumber}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.send(buffer);
    }

    // 2. ORDEN DE COMPRA (OC-...) O FACTURA DE COMPRA / GASTO (BILL)
    if (isOC) {
      const productIds = itemsList.map((i: any) => i.productId).filter(Boolean);
      let productMap: Record<string, any> = {};
      if (productIds.length > 0) {
        const dbProducts = await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, sku: true, name: true }
        });
        dbProducts.forEach(p => { productMap[p.id] = p; });
      }

      const enrichedItems = itemsList.map((it: any) => {
        const prod = it.productId ? productMap[it.productId] : null;
        const sku = it.sku || prod?.sku || '';
        let supplierCode = it.supplierCode || prod?.supplierCode || '';
        let name = it.name || it.description || 'Producto';
        
        if (name.includes('| Ref:')) {
          const parts = name.split('| Ref:');
          name = parts[0].trim();
          if (!supplierCode && parts[1]) {
            supplierCode = parts[1].trim();
          }
        }

        return {
          sku,
          supplierCode,
          name,
          quantity: Number(it.quantity || 1),
          unit: it.unit || 'UNIDAD',
          costPrice: Number(it.unitPrice || it.price || 0),
          notes: it.notes || ''
        };
      });

      const { generatePurchaseOrderPDFBuffer } = require('../services/purchaseOrderPdf.service');
      const { buffer, orderNumber } = await generatePurchaseOrderPDFBuffer({
        orderNumber: invoice.code,
        supplierName: contact?.name || 'PROVEEDOR',
        supplierTaxId: contact?.taxId || 'J-00000000-0',
        supplierPhone: contact?.phone || '',
        supplierAddress: contact?.address || '',
        companyName,
        companyTaxId,
        companyAddress,
        companyPhone,
        companyEmail,
        logoPath,
        tasaBCV,
        items: enrichedItems,
        notes: invoice.notes || ''
      });

      const filename = `${orderNumber}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.send(buffer);
    }

    return res.status(400).json({ success: false, error: { message: 'Tipo no soportado para PDF directo' } });
  } catch (err: any) {
    console.error('Error generating invoice PDF:', err);
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

export async function getNextReturnCode(projectId: string, isCustomerReturn: boolean): Promise<string> {
  const prefix = isCustomerReturn ? 'DEV-CLI' : 'DEV-PROV';
  
  // Buscar devoluciones existentes en el proyecto
  const lastInvoices = await prisma.invoice.findMany({
    where: {
      projectId,
      code: { startsWith: prefix }
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  let maxNum = 0;
  for (const inv of lastInvoices) {
    const match = inv.code.trim().match(/(\d+)$/);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val > maxNum) {
        maxNum = val;
      }
    }
  }

  let candidate = `${prefix}-${String(maxNum + 1).padStart(4, '0')}`;
  while (await prisma.invoice.findUnique({ where: { code: candidate } })) {
    maxNum++;
    candidate = `${prefix}-${String(maxNum).padStart(4, '0')}`;
  }

  return candidate;
}

export const createInvoiceReturn = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const { 
      items, // Array<{ productId?: string; name: string; quantity: number; unitPrice: number; reason: string; stockAction: 'RESTOCK' | 'QUARANTINE' | 'NONE' }>
      reason, // Motivo general
      notes,
      creditNoteCode, // Código de Nota de Crédito/Débito opcional
      returnDate
    } = req.body;

    const sourceDoc = await prisma.invoice.findUnique({
      where: { id },
      include: {
        project: true
      }
    });

    if (!sourceDoc) {
      return res.status(404).json({ success: false, error: { message: 'Documento original no encontrado' } });
    }

    const hasAccess = await checkProjectWriteAccess(user, sourceDoc.projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para registrar devoluciones en este proyecto' } });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'Debe especificar al menos un ítem a devolver con su cantidad' } });
    }

    // Parsear líneas y devoluciones previas del documento origen
    let sourceLines: any = { items: [] };
    try {
      if (sourceDoc.lines) {
        sourceLines = typeof sourceDoc.lines === 'string' ? JSON.parse(sourceDoc.lines) : sourceDoc.lines;
        if (Array.isArray(sourceLines)) {
          sourceLines = { items: sourceLines };
        }
      }
    } catch (_) {
      sourceLines = { items: [] };
    }

    const originalItems = sourceLines.items || [];
    const previousReturns: any[] = sourceLines.returns || [];

    // Calcular cuántas unidades ya se han devuelto de cada producto
    const returnedQtyByItem: Record<string, number> = {};
    previousReturns.forEach(ret => {
      if (Array.isArray(ret.items)) {
        ret.items.forEach((it: any) => {
          const key = it.productId || it.name || it.description;
          returnedQtyByItem[key] = (returnedQtyByItem[key] || 0) + Number(it.quantity || 0);
        });
      }
    });

    // Validar cantidades a devolver contra lo facturado/despachado remanente
    let returnSubtotal = 0;
    const validatedItems: any[] = [];

    for (const item of items) {
      const qtyToReturn = Number(item.quantity || 0);
      if (qtyToReturn <= 0) continue;

      const itemKey = item.productId || item.name || item.description;
      // Buscar en items originales
      const orig = originalItems.find((oi: any) => (oi.productId && oi.productId === item.productId) || oi.name === item.name || oi.description === item.name);
      
      const originalQty = orig ? Number(orig.quantity || 0) : qtyToReturn;
      const alreadyReturned = returnedQtyByItem[itemKey] || 0;
      const remainingAvailable = Math.max(0, originalQty - alreadyReturned);

      if (qtyToReturn > remainingAvailable && remainingAvailable > 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: `La cantidad a devolver (${qtyToReturn}) para "${item.name || itemKey}" excede la cantidad remanente disponible (${remainingAvailable}).`
          }
        });
      }

      const unitPrice = Number(item.unitPrice || orig?.unitPrice || orig?.price || 0);
      const subtotal = Number(item.subtotal || (qtyToReturn * unitPrice));
      returnSubtotal += subtotal;

      validatedItems.push({
        productId: item.productId || orig?.productId || null,
        name: item.name || orig?.name || orig?.description || 'Producto',
        quantity: qtyToReturn,
        unitPrice,
        subtotal,
        unit: item.unit || orig?.unit || 'UNIDAD',
        reason: item.reason || reason || 'Devolución de mercancía',
        stockAction: item.stockAction || 'RESTOCK' // RESTOCK, QUARANTINE, NONE
      });
    }

    if (validatedItems.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'No se indicaron cantidades válidas mayores a cero para devolver' } });
    }

    const isCustomerReturn = sourceDoc.type === 'INVOICE';
    const returnCode = await getNextReturnCode(sourceDoc.projectId, isCustomerReturn);
    const returnDateObj = returnDate ? new Date(returnDate) : new Date();

    // Determinar si la devolución es parcial o total comparando cantidades globales
    let totalOriginalQty = 0;
    originalItems.forEach((oi: any) => { totalOriginalQty += Number(oi.quantity || 0); });

    let totalReturnedSoFar = 0;
    Object.values(returnedQtyByItem).forEach(q => { totalReturnedSoFar += q; });
    validatedItems.forEach(vi => { totalReturnedSoFar += vi.quantity; });

    const isTotalReturn = totalOriginalQty > 0 && totalReturnedSoFar >= totalOriginalQty;

    const returnRecord = {
      returnCode,
      sourceDocId: sourceDoc.id,
      sourceDocCode: sourceDoc.code,
      sourceType: sourceDoc.type,
      isCustomerReturn,
      returnDate: returnDateObj.toISOString(),
      isTotalReturn,
      reason: reason || 'Devolución de mercancía',
      notes: notes || '',
      amount: returnSubtotal,
      currency: sourceDoc.currency,
      items: validatedItems,
      creditNoteCode: creditNoteCode || (isCustomerReturn ? `NC-${returnCode.replace('DEV-CLI-', '')}` : `ND-${returnCode.replace('DEV-PROV-', '')}`),
      createdBy: user.id,
      createdAt: new Date().toISOString()
    };

    // Operación transaccional
    const result = await prisma.$transaction(async (tx) => {
      // 1. Ajustar Inventario de productos según el destino seleccionado
      for (const it of validatedItems) {
        if (it.productId && it.productId !== 'CUSTOM') {
          const qty = Number(it.quantity);

          if (isCustomerReturn) {
            // DEVOLUCIÓN DE CLIENTE:
            // Si el stockAction es 'RESTOCK', reingresa al inventario vendible (+ stock)
            // Si es 'QUARANTINE', el producto entra a averías/cuarentena sin inflar el disponible
            if (it.stockAction === 'RESTOCK') {
              await tx.product.update({
                where: { id: it.productId },
                data: { stock: { increment: qty } }
              });
            }
          } else {
            // DEVOLUCIÓN A PROVEEDOR (COMPRAS):
            // La mercancía sale del almacén hacia el proveedor (- stock)
            if (it.stockAction !== 'NONE') {
              await tx.product.update({
                where: { id: it.productId },
                data: { stock: { decrement: qty } }
              });
            }
          }
        }
      }

      // 2. Actualizar documento origen (guardar historial de devoluciones y ajustar saldo/estado)
      const updatedReturnsList = [...previousReturns, returnRecord];
      const updatedSourceLines = {
        ...sourceLines,
        returns: updatedReturnsList,
        hasReturns: true,
        lastReturnAt: returnRecord.createdAt
      };

      // Si el saldo pendiente era mayor a 0, rebajarlo con el valor de la devolución
      const newOutstanding = Math.max(0, Number(sourceDoc.outstanding || 0) - returnSubtotal);
      
      let newStatus = sourceDoc.status;
      if (isTotalReturn) {
        newStatus = 'CANCELLED';
      }

      const updatedSourceDoc = await tx.invoice.update({
        where: { id: sourceDoc.id },
        data: {
          lines: JSON.stringify(updatedSourceLines),
          outstanding: newOutstanding,
          status: newStatus,
          notes: [sourceDoc.notes, `Devolución ${returnCode} registrada (${isTotalReturn ? 'Total' : 'Parcial'} por ${returnSubtotal.toFixed(2)} ${sourceDoc.currency})`].filter(Boolean).join(' | ')
        }
      });

      return {
        returnRecord,
        updatedSourceDoc
      };
    });

    // Registrar en log de auditoría
    try {
      const { logActivity } = await import('../services/activityLog.service');
      await logActivity(
        user.id,
        'CREATE',
        'InvoiceReturn',
        result.returnRecord.returnCode,
        `Registro de devolución ${result.returnRecord.returnCode} para ${sourceDoc.code} (${isTotalReturn ? 'TOTAL' : 'PARCIAL'})`,
        {
          sourceDocId: sourceDoc.id,
          sourceDocCode: sourceDoc.code,
          returnAmount: returnSubtotal,
          currency: sourceDoc.currency,
          isCustomerReturn,
          isTotalReturn,
          itemsCount: validatedItems.length
        },
        req.ip,
        req.headers['user-agent'] as string
      );
    } catch (e) {
      console.error('Error logActivity return:', e);
    }

    return res.status(201).json({
      success: true,
      data: result.returnRecord,
      message: `Devolución ${result.returnRecord.returnCode} registrada exitosamente.`
    });

  } catch (error: any) {
    console.error('[createInvoiceReturn] Error:', error);
    return res.status(500).json({ success: false, error: { message: error.message || 'Error al procesar devolución' } });
  }
};

