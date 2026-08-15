import { Request, Response } from 'express';
import prisma from '../config/database';
import { checkProjectWriteAccess, getProjectAccessFilter } from '../utils/projectAccess';

// GET /api/pos/session/active?projectId=...
export const getActiveSession = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ success: false, error: { message: 'El ID del proyecto es requerido' } });
    }

    const hasAccess = await checkProjectWriteAccess(req.user!, projectId as string);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'Sin acceso a este proyecto' } });
    }

    const session = await prisma.pOSSession.findFirst({
      where: {
        projectId: projectId as string,
        userId: req.user!.id,
        status: 'OPEN'
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        project: { select: { id: true, name: true, code: true } },
        invoices: {
          where: { status: { not: 'CANCELLED' } },
          select: { id: true, code: true, total: true, currency: true, createdAt: true }
        }
      }
    });

    res.json({ success: true, data: session });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// POST /api/pos/session/open
export const openSession = async (req: Request, res: Response) => {
  try {
    const { projectId, initialBalanceUsd = 0, initialBalanceBs = 0, notes } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: { message: 'El proyecto es requerido para abrir turno de caja' } });
    }

    const hasAccess = await checkProjectWriteAccess(req.user!, projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'Sin acceso a este proyecto' } });
    }

    // Verificar si ya existe una sesión abierta para el usuario en este proyecto
    const existing = await prisma.pOSSession.findFirst({
      where: {
        projectId,
        userId: req.user!.id,
        status: 'OPEN'
      }
    });

    if (existing) {
      return res.json({ success: true, message: 'Ya tienes un turno de caja abierto', data: existing });
    }

    const session = await prisma.pOSSession.create({
      data: {
        projectId,
        userId: req.user!.id,
        initialBalanceUsd: parseFloat(initialBalanceUsd) || 0,
        initialBalanceBs: parseFloat(initialBalanceBs) || 0,
        status: 'OPEN',
        notes
      },
      include: {
        project: { select: { id: true, name: true, code: true } }
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'POS_OPEN_SESSION',
        entity: 'POSSession',
        entityId: session.id,
        description: `Apertura de turno de caja POS en proyecto "${session.project.name}". Fondo inicial: $${session.initialBalanceUsd} / Bs. ${session.initialBalanceBs}`
      }
    });

    res.json({ success: true, message: 'Turno de caja abierto con éxito', data: session });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// POST /api/pos/session/close
export const closeSession = async (req: Request, res: Response) => {
  try {
    const { sessionId, finalBalanceUsd = 0, finalBalanceBs = 0, notes } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: { message: 'El ID de sesión es requerido' } });
    }

    const session = await prisma.pOSSession.findUnique({
      where: { id: sessionId },
      include: { project: true }
    });

    if (!session || session.status !== 'OPEN') {
      return res.status(400).json({ success: false, error: { message: 'La sesión no existe o ya está cerrada' } });
    }

    const closedSession = await prisma.pOSSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        finalBalanceUsd: parseFloat(finalBalanceUsd) || 0,
        finalBalanceBs: parseFloat(finalBalanceBs) || 0,
        notes: notes ? `${session.notes || ''} | Cierre: ${notes}` : session.notes
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'POS_CLOSE_SESSION',
        entity: 'POSSession',
        entityId: session.id,
        description: `Cierre de turno de caja (Cierre Z) en proyecto "${session.project.name}". Conteo final: $${finalBalanceUsd} / Bs. ${finalBalanceBs}`
      }
    });

    res.json({ success: true, message: 'Turno de caja cerrado exitosamente (Cierre Z)', data: closedSession });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// GET /api/pos/session/summary?sessionId=...
export const getSessionSummary = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: { message: 'El ID de la sesión es requerido' } });
    }

    const session = await prisma.pOSSession.findUnique({
      where: { id: sessionId as string },
      include: {
        project: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        invoices: {
          where: { status: { not: 'CANCELLED' } },
          include: {
            payments: {
              include: { payment: { include: { account: true } } }
            }
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: { message: 'Sesión no encontrada' } });
    }

    // Agrupar ventas por moneda y método de pago
    let totalSalesUsd = 0;
    let totalSalesBs = 0;
    let countInvoices = session.invoices.length;

    const paymentTotalsByMethod: Record<string, { amountUsd: number; amountBs: number }> = {};

    session.invoices.forEach(inv => {
      if (inv.currency === 'USD') totalSalesUsd += inv.total;
      else if (inv.currency === 'BS') totalSalesBs += inv.total;

      inv.payments.forEach(alloc => {
        const p = alloc.payment;
        const methodKey = `${p.method} (${p.currency})`;
        if (!paymentTotalsByMethod[methodKey]) {
          paymentTotalsByMethod[methodKey] = { amountUsd: 0, amountBs: 0 };
        }
        if (p.currency === 'USD') paymentTotalsByMethod[methodKey].amountUsd += p.amount;
        else paymentTotalsByMethod[methodKey].amountBs += p.amount;
      });
    });

    res.json({
      success: true,
      data: {
        session,
        countInvoices,
        totalSalesUsd,
        totalSalesBs,
        paymentTotalsByMethod
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// POST /api/pos/sale
export const processPOSSale = async (req: Request, res: Response) => {
  try {
    const {
      projectId,
      posSessionId,
      customer, // string (ID) u objeto { name, taxId, phone, email, address }
      items, // [{ productId, quantity, unitPrice, costPrice, name }]
      currency = 'USD',
      payments, // [{ method, currency, amount, accountId, reference }]
      taxRate = 16,
      notes
    } = req.body;

    if (!projectId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Proyecto y al menos un producto en el carrito son requeridos.' }
      });
    }

    const hasAccess = await checkProjectWriteAccess(req.user!, projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'Sin acceso a este proyecto' } });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ success: false, error: { message: 'Proyecto no encontrado' } });
    }

    // 1. Obtener o crear Cliente (Mostrador por defecto o Cliente Express)
    let contactId: string | undefined = undefined;
    let contactName = 'Venta de Mostrador (Cliente Contado)';
    let contactTaxId = 'V-99999999';

    if (typeof customer === 'string' && customer.trim() !== '') {
      const existingContact = await prisma.contactPerson.findUnique({ where: { id: customer } });
      if (existingContact) {
        contactId = existingContact.id;
        contactName = existingContact.name;
        contactTaxId = existingContact.taxId || 'V-99999999';
      }
    } else if (typeof customer === 'object' && customer?.name) {
      // Crear o buscar cliente express por RIF/taxId
      const searchTax = customer.taxId ? customer.taxId.trim() : 'V-99999999';
      let contactObj = await prisma.contactPerson.findFirst({
        where: { projectId, taxId: searchTax }
      });

      if (!contactObj) {
        contactObj = await prisma.contactPerson.create({
          data: {
            projectId,
            name: customer.name,
            taxId: searchTax,
            phone: customer.phone || null,
            email: customer.email || null,
            address: customer.address || null,
            type: 'CUSTOMER'
          }
        });
      }
      contactId = contactObj.id;
      contactName = contactObj.name;
      contactTaxId = contactObj.taxId || searchTax;
    } else {
      // Buscar cliente genérico por defecto en este proyecto
      let genericContact = await prisma.contactPerson.findFirst({
        where: { projectId, taxId: 'V-99999999' }
      });

      if (!genericContact) {
        genericContact = await prisma.contactPerson.create({
          data: {
            projectId,
            name: 'Venta de Mostrador (Cliente Contado)',
            taxId: 'V-99999999',
            type: 'CUSTOMER'
          }
        });
      }
      contactId = genericContact.id;
      contactName = genericContact.name;
    }

    // 2. Verificar Stock disponible de cada producto en la transacción
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({ success: false, error: { message: 'Todos los ítems deben tener productId y cantidad válida.' } });
      }

      const prod = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!prod || !prod.isActive) {
        return res.status(404).json({ success: false, error: { message: `El producto "${item.name || item.productId}" no está activo.` } });
      }

      if (prod.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          error: { message: `Stock insuficiente para "${prod.name}". Disponible: ${prod.stock}, Solicitado: ${item.quantity}` }
        });
      }
    }

    // 3. Generar Código Único de Recibo / Venta POS (ej: POS-20260812-0042)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await prisma.invoice.count({
      where: { projectId, code: { startsWith: `POS-${dateStr}` } }
    });
    const seqStr = String(countToday + 1).padStart(4, '0');
    const posCode = `POS-${dateStr}-${seqStr}`;

    // 4. Calcular Totales y Costos de Venta
    let totalSale = 0;
    let totalCost = 0;

    const formattedLines = items.map((item: any) => {
      const price = parseFloat(item.unitPrice) || 0;
      const qty = parseFloat(item.quantity) || 1;
      const cost = parseFloat(item.costPrice || item.packagingCost) || 0;
      const lineTotal = price * qty;

      totalSale += lineTotal;
      totalCost += cost * qty;

      return {
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        quantity: qty,
        unitPrice: price,
        costPrice: cost,
        total: lineTotal
      };
    });

    const netProfit = totalSale - totalCost;

    // 5. Ejecutar la Transacción Atómica en Base de Datos
    const result = await prisma.$transaction(async (tx) => {
      // A. Rebajar stock de productos
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: parseFloat(item.quantity) } }
        });
      }

      // B. Crear la Factura / Nota de Venta POS
      const invoice = await tx.invoice.create({
        data: {
          projectId,
          posSessionId: posSessionId || null,
          code: posCode,
          type: 'INVOICE',
          customerId: contactId,
          issueDate: new Date(),
          currency,
          total: totalSale,
          outstanding: 0,
          status: 'PAID',
          lines: JSON.stringify(formattedLines),
          totalCost,
          netProfit,
          createdBy: req.user!.id
        }
      });

      // C. Registrar Pagos y Allocations si se recibieron métodos de cobro
      const createdPayments = [];
      if (Array.isArray(payments) && payments.length > 0) {
        for (const p of payments) {
          const pAmount = parseFloat(p.amount) || 0;
          if (pAmount <= 0) continue;

          const pCode = `PAY-${posCode}-${Date.now().toString().slice(-4)}`;
          const paymentRec = await tx.payment.create({
            data: {
              projectId,
              code: pCode,
              date: new Date(),
              currency: p.currency || currency,
              amount: pAmount,
              method: p.method || 'CASH',
              reference: p.reference || null,
              status: 'COMPLETED',
              userId: req.user!.id,
              accountId: p.accountId || null,
              allocations: {
                create: {
                  invoiceId: invoice.id,
                  allocatedAmount: pAmount
                }
              }
            }
          });
          createdPayments.push(paymentRec);
        }
      }

      // D. Log de Auditoría
      await tx.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'POS_SALE_CREATE',
          entity: 'Invoice',
          entityId: invoice.id,
          description: `Venta POS "${posCode}" procesada por ${currency} ${totalSale.toFixed(2)} para el cliente "${contactName}".`
        }
      });

      return { invoice, createdPayments };
    });

    res.json({
      success: true,
      message: `Venta POS ${posCode} procesada exitosamente`,
      data: {
        invoice: result.invoice,
        payments: result.createdPayments,
        customerName: contactName,
        customerTaxId: contactTaxId,
        posCode
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// POST /api/pos/sale/:id/void
export const voidPOSSale = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        project: true,
        payments: { include: { payment: true } }
      }
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: { message: 'Venta/Documento no encontrado' } });
    }

    if (invoice.status === 'CANCELLED') {
      return res.status(400).json({ success: false, error: { message: 'Esta venta ya se encuentra anulada/reversada' } });
    }

    const hasAccess = await checkProjectWriteAccess(req.user!, invoice.projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'Sin permisos para anular ventas en este proyecto' } });
    }

    // Parsear los ítems vendidos
    let lines: any[] = [];
    if (invoice.lines) {
      try {
        lines = JSON.parse(invoice.lines);
      } catch (e) {}
    }

    // Ejecutar la Reversión Atómica
    await prisma.$transaction(async (tx) => {
      // 1. Restaurar stock al inventario
      for (const line of lines) {
        if (line.productId && line.quantity) {
          const prodExists = await tx.product.findUnique({ where: { id: line.productId } });
          if (prodExists) {
            await tx.product.update({
              where: { id: line.productId },
              data: { stock: { increment: parseFloat(line.quantity) } }
            });
          }
        }
      }

      // 2. Marcar documento como CANCELLED
      await tx.invoice.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          outstanding: invoice.total
        }
      });

      // 3. Marcar pagos asociados como CANCELLED
      for (const alloc of invoice.payments) {
        if (alloc.payment) {
          await tx.payment.update({
            where: { id: alloc.payment.id },
            data: { status: 'CANCELLED' }
          });
        }
      }

      // 4. Registrar en Log de Auditoría
      await tx.activityLog.create({
        data: {
          userId: req.user!.id,
          action: 'POS_SALE_VOID',
          entity: 'Invoice',
          entityId: invoice.id,
          description: `Anulación/Reversión de venta POS "${invoice.code}". Motivo: ${reason || 'Devolución de cliente'}`
        }
      });
    });

    res.json({
      success: true,
      message: `Venta POS ${invoice.code} anulada exitosamente. Stock devuelto al inventario.`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export default {
  getActiveSession,
  openSession,
  closeSession,
  getSessionSummary,
  processPOSSale,
  voidPOSSale,
};
