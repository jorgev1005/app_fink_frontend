import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import { updateAccountBalance } from '../services/account.service';
import { getLatestExchangeRate } from '../services/exchangeRate.service';
import { checkProjectWriteAccess, getProjectAccessFilter } from '../utils/projectAccess';
import { calculateInvoiceProfitability } from '../services/profitability.service';

async function getNextInvoiceCode(projectId: string, isDeliveryNote: boolean = false): Promise<string> {
  // 1. Fetch project to see if general settings has a value
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { lastInvoiceNumber: true, lastDeliveryNoteNumber: true }
  });

  const lastSavedCode = isDeliveryNote 
    ? project?.lastDeliveryNoteNumber 
    : project?.lastInvoiceNumber;

  let candidate = '';

  if (lastSavedCode) {
    const cleanCode = lastSavedCode.trim();
    const match = cleanCode.match(/(\d+)$/);
    if (match) {
      const numStr = match[1];
      const numVal = parseInt(numStr, 10);
      const nextVal = numVal + 1;
      const paddedNumStr = String(nextVal).padStart(numStr.length, '0');
      const prefix = cleanCode.substring(0, cleanCode.length - numStr.length);
      candidate = `${prefix}${paddedNumStr}`;
    }
  }

  if (!candidate) {
    // 2. Fallback to querying recent invoices in DB if no setting exists
    const lastInvoices = await prisma.invoice.findMany({
      where: {
        projectId,
        type: 'INVOICE',
        ...(isDeliveryNote ? {
          code: { startsWith: 'NE' }
        } : {
          AND: [
            { code: { not: { startsWith: 'NE' } } },
            { code: { not: { startsWith: 'POS-' } } }
          ]
        })
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    for (const inv of lastInvoices) {
      const cleanCode = inv.code.trim();
      const match = cleanCode.match(/(\d+)$/);
      if (match) {
        const numStr = match[1];
        const numVal = parseInt(numStr, 10);
        const nextVal = numVal + 1;
        const paddedNumStr = String(nextVal).padStart(numStr.length, '0');
        const prefix = cleanCode.substring(0, cleanCode.length - numStr.length);
        candidate = `${prefix}${paddedNumStr}`;
        break;
      }
    }
  }

  if (!candidate) {
    candidate = isDeliveryNote ? 'NE-0001' : '0001';
  }

  // 3. Ensure global uniqueness across the invoices table
  while (await prisma.invoice.findUnique({ where: { code: candidate } })) {
    const match = candidate.match(/(\d+)$/);
    if (match) {
      const numStr = match[1];
      const nextVal = parseInt(numStr, 10) + 1;
      const paddedNumStr = String(nextVal).padStart(numStr.length, '0');
      const prefix = candidate.substring(0, candidate.length - numStr.length);
      candidate = `${prefix}${paddedNumStr}`;
    } else {
      candidate = `${candidate}-${Date.now()}`;
    }
  }

  return candidate;
}

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

      // Update Project general settings sequence numbers
      if (type === 'INVOICE') {
        if (isDeliveryNote) {
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

      // 1. Revert stock changes
      let items: any[] = [];
      try {
        if (invoice.lines) {
          const parsed = typeof invoice.lines === 'string' ? JSON.parse(invoice.lines) : invoice.lines;
          if (parsed) {
            if (Array.isArray(parsed)) {
              items = parsed;
            } else if (parsed.items && Array.isArray(parsed.items)) {
              items = parsed.items;
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse invoice lines on delete', e);
      }

      if (invoice.status !== 'DRAFT' && items.length > 0) {
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

    const enrichedInvoices = invoices.map((inv: any) => ({
        ...inv,
        vendor: inv.vendorId ? contactMap.get(inv.vendorId) : null,
        customer: inv.customerId ? contactMap.get(inv.customerId) : null,
        contact: inv.vendorId ? contactMap.get(inv.vendorId) : (inv.customerId ? contactMap.get(inv.customerId) : null),
        project: inv.projectId ? projectMap.get(inv.projectId) : null
    }));

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
    
    res.json({ 
      success: true, 
      data: {
        ...invoice,
        contact
      } 
    });
  } catch (error: any) {
    console.error('[getInvoiceById] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
