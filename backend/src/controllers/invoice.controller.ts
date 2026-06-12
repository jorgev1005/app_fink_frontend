import { Request, Response } from 'express';
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

  if (lastSavedCode) {
    const cleanCode = lastSavedCode.trim();
    const match = cleanCode.match(/(\d+)$/);
    if (match) {
      const numStr = match[1];
      const numVal = parseInt(numStr, 10);
      const nextVal = numVal + 1;
      const paddedNumStr = String(nextVal).padStart(numStr.length, '0');
      const prefix = cleanCode.substring(0, cleanCode.length - numStr.length);
      return `${prefix}${paddedNumStr}`;
    }
  }

  // 2. Fallback to querying recent invoices in DB if no setting exists
  const lastInvoices = await prisma.invoice.findMany({
    where: {
      projectId,
      type: 'INVOICE',
      code: isDeliveryNote ? { startsWith: 'NE' } : { not: { startsWith: 'NE' } }
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
      return `${prefix}${paddedNumStr}`;
    }
  }

  return isDeliveryNote ? 'NE-0001' : '0001';
}

export const createInvoice = async (req: Request, res: Response) => {
  try {
    const { 
      projectId, type, issueDate, dueDate, currency, total, code,
      vendorId, customerId, description, taxAmount,
      isPaid, paymentAccountId, paymentMethod, paymentReference, lines,
      status, isDeliveryNote
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
        return res.status(400).json({ success: false, error: { message: 'El proveedor es obligatorio para facturas de compra' } });
    }
    if (type === 'INVOICE' && !customerId) {
        return res.status(400).json({ success: false, error: { message: 'El cliente es obligatorio para facturas de venta' } });
    }

    let invoiceCode = code;
    if (!invoiceCode) {
      if (type === 'INVOICE') {
        invoiceCode = await getNextInvoiceCode(projectId, !!isDeliveryNote);
      } else {
        invoiceCode = `INV-${projectId}-${Date.now()}`;
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
      vendorId, customerId, description, taxAmount, lines, status 
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
          issueDate: issueDate ? new Date(issueDate) : invoice.issueDate,
          dueDate: dueDate ? new Date(dueDate) : invoice.dueDate,
          currency: currency || invoice.currency,
          total: total !== undefined ? Number(total) : invoice.total,
          outstanding: total !== undefined ? Number(total) : invoice.outstanding,
          status: targetStatus,
          lines: JSON.stringify(finalLinesData),
          vendorId: vendorId !== undefined ? (vendorId || null) : invoice.vendorId,
          customerId: customerId !== undefined ? (customerId || null) : invoice.customerId,
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
    
    // Only allow deleting DRAFT or PENDING or OPEN invoices
    if (invoice.status === 'PAID' || invoice.status === 'POSTED') {
      return res.status(400).json({ success: false, error: { message: 'Cannot delete paid or posted invoice' } });
    }

    await prisma.$transaction(async (tx) => {
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

      // 2. Delete the invoice
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
    const { projectId, status, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const user = (req as any).user;
    const where: any = {
      ...getProjectAccessFilter(user)
    };
    if (projectId) where.projectId = projectId as string;
    if (status) where.status = status as string;

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

    const enrichedInvoices = invoices.map((inv: any) => ({
        ...inv,
        vendor: inv.vendorId ? contactMap.get(inv.vendorId) : null,
        customer: inv.customerId ? contactMap.get(inv.customerId) : null,
        contact: inv.vendorId ? contactMap.get(inv.vendorId) : (inv.customerId ? contactMap.get(inv.customerId) : null)
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
      include: { project: true }
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
