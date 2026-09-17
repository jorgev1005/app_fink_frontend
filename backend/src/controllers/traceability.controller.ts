import { Request, Response } from 'express';
import prisma from '../config/database';
import { loadAllQuotes } from './quotation.controller';

interface TraceNode {
  id: string;
  type: 'COTIZACION' | 'ORDEN_COMPRA' | 'FACTURA_COMPRA' | 'NOTA_ENTREGA' | 'FACTURA_VENTA' | 'PAGO_COBRO' | 'DEVOLUCION_VENTA' | 'DEVOLUCION_COMPRA' | 'NOTA_CREDITO';
  stream: 'COMMERCIAL' | 'LOGISTICS' | 'FINANCIAL' | 'REVERSE';
  code: string;
  title: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  statusBadge: string;
  date: string;
  amount: number;
  currency: string;
  contactName: string;
  contactTaxId?: string;
  items?: Array<{
    name: string;
    quantity: number;
    unitPrice?: number;
    subtotal?: number;
    unit?: string;
  }>;
  details?: Record<string, any>;
  parentId?: string | null;
  childrenIds?: string[];
  docId?: string;
  pdfUrl?: string;
}

export const getTraceability = async (req: Request, res: Response) => {
  try {
    const { codeOrId } = req.params;
    if (!codeOrId) {
      return res.status(400).json({ success: false, error: { message: 'Debe especificar un código o ID de documento' } });
    }

    const term = codeOrId.trim();
    const allQuotes = loadAllQuotes();

    // 1. Buscar si coincide con alguna cotización
    let quote = allQuotes.find(q => 
      q && (
        (q.id && q.id.toLowerCase() === term.toLowerCase()) ||
        (q.correlative && q.correlative.toLowerCase() === term.toLowerCase())
      )
    );

    // 2. Buscar si coincide con alguna factura/nota en base de datos
    let targetInvoice = await prisma.invoice.findFirst({
      where: {
        OR: [
          { id: term },
          { code: { equals: term, mode: 'insensitive' } }
        ]
      },
      include: {
        project: true,
        payments: {
          include: {
            payment: {
              include: {
                account: true,
                user: true,
                transaction: true
              }
            }
          }
        }
      }
    });

    // Parsear metadatos de líneas si existen
    const parseInvoiceMeta = (inv: any) => {
      let meta: any = {};
      try {
        if (inv?.lines) {
          const parsed = typeof inv.lines === 'string' ? JSON.parse(inv.lines) : inv.lines;
          if (parsed && typeof parsed === 'object') {
            meta = parsed;
          }
        }
      } catch (_) {}
      return meta;
    };

    // Si encontramos una factura/nota pero no cotización, ver si la factura viene de una cotización
    if (!quote && targetInvoice) {
      const invMeta = parseInvoiceMeta(targetInvoice);
      const poRef = targetInvoice.purchaseOrder || invMeta.sourceQuotationCode;
      if (poRef && typeof poRef === 'string' && poRef.startsWith('COT-')) {
        quote = allQuotes.find(q => 
          q && (
            (q.id && q.id.toLowerCase() === poRef.toLowerCase()) ||
            (q.correlative && q.correlative.toLowerCase() === poRef.toLowerCase())
          )
        );
      }
    }

    // Identificador de cotización ancla (si existe)
    const cotCorrelative = quote ? (quote.correlative || quote.id) : null;

    // 3. Recopilar todos los documentos del cluster
    const clusterInvoices: any[] = [];
    const invoiceIdsSet = new Set<string>();

    const addInvoiceToCluster = (inv: any) => {
      if (inv && !invoiceIdsSet.has(inv.id)) {
        invoiceIdsSet.add(inv.id);
        clusterInvoices.push(inv);
      }
    };

    if (targetInvoice) {
      addInvoiceToCluster(targetInvoice);
    }

    // Si hay cotización, buscar todas las facturas/notas/OC vinculadas a esa cotización
    if (cotCorrelative) {
      const relatedByPO = await prisma.invoice.findMany({
        where: {
          OR: [
            { purchaseOrder: { equals: cotCorrelative, mode: 'insensitive' } },
            { purchaseOrder: { contains: cotCorrelative, mode: 'insensitive' } },
            { notes: { contains: cotCorrelative, mode: 'insensitive' } }
          ],
          status: { not: 'CANCELLED' }
        },
        include: {
          project: true,
          payments: {
            include: {
              payment: {
                include: {
                  account: true,
                  user: true,
                  transaction: true
                }
              }
            }
          }
        }
      });
      relatedByPO.forEach(addInvoiceToCluster);

      // Si la cotización tiene purchaseOrderNumber (O.C. emitida)
      if (quote.purchaseOrderNumber) {
        const poInvoices = await prisma.invoice.findMany({
          where: {
            code: { equals: quote.purchaseOrderNumber, mode: 'insensitive' }
          },
          include: {
            project: true,
            payments: {
              include: {
                payment: {
                  include: { account: true, user: true, transaction: true }
                }
              }
            }
          }
        });
        poInvoices.forEach(addInvoiceToCluster);
      }
    }

    // Expandir referencias cruzadas entre Notas de Entrega, Facturas y Órdenes de Compra
    const neCodesToSearch: string[] = [];
    const invCodesToSearch: string[] = [];
    const poCodesToSearch: string[] = [];

    clusterInvoices.forEach(inv => {
      const meta = parseInvoiceMeta(inv);
      if (meta.invoicedAsCode) invCodesToSearch.push(meta.invoicedAsCode);
      if (meta.invoicedAsId) invCodesToSearch.push(meta.invoicedAsId);
      if (meta.convertedToBillCode) invCodesToSearch.push(meta.convertedToBillCode);
      if (meta.convertedToBillId) invCodesToSearch.push(meta.convertedToBillId);
      if (meta.sourcePurchaseOrderCode) poCodesToSearch.push(meta.sourcePurchaseOrderCode);
      if (meta.sourcePurchaseOrderId) poCodesToSearch.push(meta.sourcePurchaseOrderId);
      if (inv.purchaseOrder) poCodesToSearch.push(inv.purchaseOrder);
      if (meta.sourceDeliveryNoteCode) neCodesToSearch.push(meta.sourceDeliveryNoteCode);
      if (meta.sourceDeliveryNoteId) neCodesToSearch.push(meta.sourceDeliveryNoteId);
    });

    const allSearchKeys = [...neCodesToSearch, ...invCodesToSearch, ...poCodesToSearch].filter(Boolean);

    if (allSearchKeys.length > 0) {
      const moreInvoices = await prisma.invoice.findMany({
        where: {
          OR: [
            { id: { in: allSearchKeys } },
            { code: { in: allSearchKeys } },
            { purchaseOrder: { in: allSearchKeys } }
          ]
        },
        include: {
          project: true,
          payments: {
            include: {
              payment: {
                include: { account: true, user: true, transaction: true }
              }
            }
          }
        }
      });
      moreInvoices.forEach(addInvoiceToCluster);
    }

    // Cargar nombres de contactos para las facturas del cluster
    const contactIds = new Set<string>();
    clusterInvoices.forEach(inv => {
      if (inv.customerId) contactIds.add(inv.customerId);
      if (inv.vendorId) contactIds.add(inv.vendorId);
    });

    const contactMap = new Map<string, { id: string; name: string; taxId: string | null }>();
    if (contactIds.size > 0) {
      const contacts = await prisma.contactPerson.findMany({
        where: { id: { in: Array.from(contactIds) } },
        select: { id: true, name: true, taxId: true }
      });
      contacts.forEach(c => contactMap.set(c.id, c));
    }

    // Si aún no tenemos nada
    if (!quote && clusterInvoices.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: `No se encontró ningún documento con el código o ID: "${term}"` }
      });
    }

    // 4. Clasificar documentos en categorías
    const purchaseOrders: any[] = [];
    const bills: any[] = [];
    const deliveryNotes: any[] = [];
    const salesInvoices: any[] = [];

    clusterInvoices.forEach(inv => {
      const isPO = inv.code?.toUpperCase().startsWith('OC-');
      const isBill = inv.type === 'BILL' && !isPO;
      const isNE = inv.code?.toUpperCase().startsWith('NE');

      if (isPO) purchaseOrders.push(inv);
      else if (isBill) bills.push(inv);
      else if (isNE) deliveryNotes.push(inv);
      else salesInvoices.push(inv);
    });

    // Parsear items de cotización
    const quoteItems = Array.isArray(quote?.items) ? quote.items.map((it: any) => ({
      name: it.name || it.sku || 'Producto',
      quantity: Number(it.quantity || 1),
      unitPrice: Number(it.unitPriceUSD || it.price || 0),
      subtotal: Number(it.subtotalUSD || (it.quantity * it.unitPriceUSD) || 0),
      unit: it.unit || 'UNIDAD'
    })) : [];

    // 5. Construir los Nodos del Grafo (Interactive Tree Nodes)
    const nodes: TraceNode[] = [];
    let rootNodeId = '';

    // NODO 1: COTIZACIÓN (Si existe)
    if (quote) {
      const cotId = `node-quote-${quote.correlative || quote.id}`;
      rootNodeId = cotId;

      const statusMap: Record<string, { label: string; badge: string }> = {
        PENDING: { label: 'En Evaluación', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
        APPROVED: { label: 'Aprobada por Cliente', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
        INVOICED: { label: 'Facturada / Despachada', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
        FULLY_INVOICED: { label: 'Completamente Despachada', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
        PARTIALLY_INVOICED: { label: 'Despacho Parcial', badge: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
        REJECTED: { label: 'Rechazada', badge: 'bg-rose-100 text-rose-800 border-rose-300' },
      };

      const st = statusMap[quote.status] || { label: quote.status || 'Emitida', badge: 'bg-gray-100 text-gray-800 border-gray-300' };

      nodes.push({
        id: cotId,
        type: 'COTIZACION',
        stream: 'COMMERCIAL',
        code: quote.correlative || quote.id,
        title: 'Presupuesto / Cotización Inicial',
        subtitle: `Emitida a ${quote.customer?.name || quote.clientName || 'Cliente Prospecto'}`,
        status: quote.status || 'PENDING',
        statusLabel: st.label,
        statusBadge: st.badge,
        date: quote.createdAt,
        amount: Number(quote.totalUSD || quote.total || 0),
        currency: 'USD',
        contactName: quote.customer?.name || quote.clientName || 'Cliente Prospecto',
        contactTaxId: quote.customer?.taxId || '',
        items: quoteItems,
        details: {
          canal: quote.channel || 'Venta Comercial',
          validez: quote.validityDays ? `${quote.validityDays} días` : '15 días',
          vendedor: quote.customer?.seller || quote.seller || 'Oficina Comercial',
          notas: quote.notes || null,
          totalBs: quote.totalBs || null,
        },
        parentId: null,
        childrenIds: [],
        pdfUrl: `/backend-api/api/quotations/${quote.correlative || quote.id}/pdf`
      });
    }

    // Helper para obtener nombre del contacto
    const resolveContact = (inv: any, meta: any) => {
      const fromContact = inv.customerId ? contactMap.get(inv.customerId) : (inv.vendorId ? contactMap.get(inv.vendorId) : null);
      const name = fromContact?.name || meta?.clientName || meta?.customer?.name || meta?.vendor?.name || 'Cliente / Proveedor';
      const taxId = fromContact?.taxId || meta?.taxId || meta?.customer?.taxId || '';
      return { name, taxId };
    };

    // NODO 2: ÓRDENES DE COMPRA (Si se generó orden a proveedores por falta de stock)
    purchaseOrders.forEach((po) => {
      const poId = `node-po-${po.code || po.id}`;
      if (!rootNodeId) rootNodeId = poId;

      const meta = parseInvoiceMeta(po);
      const contact = resolveContact(po, meta);
      const items = Array.isArray(meta?.items) ? meta.items.map((i: any) => ({
        name: i.name || i.description || 'Artículo de compra',
        quantity: Number(i.quantity || 1),
        unitPrice: Number(i.unitPrice || 0),
        subtotal: Number(i.total || (i.quantity * i.unitPrice) || 0),
        unit: i.unit || 'UNIDAD'
      })) : [];

      nodes.push({
        id: poId,
        type: 'ORDEN_COMPRA',
        stream: 'LOGISTICS',
        code: po.code,
        title: 'Orden de Compra a Proveedor',
        subtitle: `Pedido para reposición de mercancía solicitada`,
        status: po.status,
        statusLabel: po.status === 'PAID' ? 'O.C. Pagada' : 'O.C. Emitida / En Proceso',
        statusBadge: po.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-indigo-100 text-indigo-800 border-indigo-300',
        date: po.issueDate ? po.issueDate.toISOString() : po.createdAt.toISOString(),
        amount: Number(po.total || 0),
        currency: po.currency || 'USD',
        contactName: contact.name,
        items,
        details: {
          proyecto: po.project?.name || 'General',
          plazoEntrega: meta.expectedDate || 'Inmediata',
          lugarEntrega: meta.deliveryAddress || 'Almacén Principal'
        },
        parentId: quote ? rootNodeId : null,
        childrenIds: [],
        docId: po.id,
        pdfUrl: `/backend-api/api/invoices/${po.id}/pdf`
      });
    });

    // NODO 3: FACTURAS DE COMPRA (Recepción de mercancía de proveedores)
    bills.forEach((bill) => {
      const billId = `node-bill-${bill.code || bill.id}`;
      const meta = parseInvoiceMeta(bill);
      const contact = resolveContact(bill, meta);

      // Ítems de la factura de compra
      const items = Array.isArray(meta?.items) ? meta.items.map((i: any) => ({
        name: i.name || i.description || 'Artículo de compra',
        quantity: Number(i.quantity || 1),
        unitPrice: Number(i.unitPrice || 0),
        subtotal: Number(i.total || (i.quantity * i.unitPrice) || 0),
        unit: i.unit || 'UNIDAD'
      })) : [];

      // Vincular con su Orden de Compra de origen
      const poCode = meta.sourcePurchaseOrderCode || bill.purchaseOrder;
      const matchedPo = poCode ? purchaseOrders.find(p => p.code?.toLowerCase() === poCode.toLowerCase() || p.id === meta.sourcePurchaseOrderId) : null;
      const parentPo = matchedPo ? `node-po-${matchedPo.code || matchedPo.id}` : (purchaseOrders.length > 0 ? `node-po-${purchaseOrders[0].code || purchaseOrders[0].id}` : (quote ? rootNodeId : null));

      if (!rootNodeId && !parentPo) {
        rootNodeId = billId;
      }

      // Buscar pagos / abonos aplicados a esta Factura de Compra
      const billPayments: any[] = [];
      if (bill.payments && Array.isArray(bill.payments)) {
        bill.payments.forEach((alloc: any) => {
          if (alloc.payment) {
            billPayments.push({
              code: alloc.payment.code,
              amount: Number(alloc.allocatedAmount || alloc.payment.amount || 0),
              currency: alloc.payment.currency || 'USD',
              date: alloc.payment.date ? alloc.payment.date.toISOString() : new Date().toISOString(),
              method: alloc.payment.method,
              reference: alloc.payment.reference,
              account: alloc.payment.account?.name || 'Caja / Banco',
              receiptUrl: `/receipts/transaction/${alloc.payment.transactionId || alloc.payment.id}`
            });
          }
        });
      }

      nodes.push({
        id: billId,
        type: 'FACTURA_COMPRA',
        stream: 'LOGISTICS',
        code: bill.code,
        title: 'Factura de Recepción de Compra',
        subtitle: `Ingreso físico a inventario / Cuenta por pagar`,
        status: bill.status,
        statusLabel: bill.status === 'PAID' ? 'Compra Pagada' : 'Por Pagar a Proveedor',
        statusBadge: bill.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-orange-100 text-orange-800 border-orange-300',
        date: bill.issueDate ? bill.issueDate.toISOString() : bill.createdAt.toISOString(),
        amount: Number(bill.total || 0),
        currency: bill.currency || 'USD',
        contactName: contact.name,
        items,
        details: {
          vencimiento: bill.dueDate ? bill.dueDate.toISOString() : null,
          saldoPendiente: Number(bill.outstanding || 0),
          ordenCompraOrigen: meta.sourcePurchaseOrderCode || bill.purchaseOrder || null,
          pagosRegistrados: billPayments
        },
        parentId: parentPo,
        childrenIds: [],
        docId: bill.id,
        pdfUrl: `/backend-api/api/invoices/${bill.id}/pdf`
      });

      // Crear subnodos para cada pago a proveedor
      billPayments.forEach((p, pIdx) => {
        const payNodeId = `node-pay-bill-${bill.code}-${pIdx}`;
        nodes.push({
          id: payNodeId,
          type: 'PAGO_COBRO',
          stream: 'FINANCIAL',
          code: p.code || `PAGO-PROV-${pIdx + 1}`,
          title: 'Pago a Proveedor',
          subtitle: `Egreso de fondos vía ${p.method || 'Transferencia'} (${p.account})`,
          status: 'COMPLETED',
          statusLabel: 'Pago Aplicado',
          statusBadge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          date: p.date,
          amount: p.amount,
          currency: p.currency,
          contactName: contact.name,
          details: {
            cuenta: p.account,
            referencia: p.reference || 'S/R',
            metodo: p.method
          },
          parentId: billId,
          childrenIds: []
        });
      });
    });

    // NODO 4: NOTAS DE ENTREGA (Despacho físico y salida de almacén al cliente)
    deliveryNotes.forEach((ne) => {
      const neId = `node-ne-${ne.code || ne.id}`;
      if (!rootNodeId) rootNodeId = neId;

      const meta = parseInvoiceMeta(ne);
      const contact = resolveContact(ne, meta);
      const items = Array.isArray(meta?.items) ? meta.items.map((i: any) => ({
        name: i.name || i.description || 'Producto despachado',
        quantity: Number(i.quantity || 1),
        unitPrice: Number(i.unitPrice || 0),
        subtotal: Number(i.total || (i.quantity * i.unitPrice) || 0),
        unit: i.unit || 'UNIDAD'
      })) : [];

      const dispatchStatus = meta.dispatchStatus || 'PENDING_DISPATCH';
      const dispatchMap: Record<string, { label: string; badge: string }> = {
        PENDING_DISPATCH: { label: '🕒 Pendiente de Despacho', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
        DISPATCHED: { label: '🚚 En Tránsito / Despachada', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
        DELIVERED: { label: '✅ Entregada al Cliente', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
      };
      const disp = dispatchMap[dispatchStatus] || dispatchMap.PENDING_DISPATCH;

      // Buscar pagos específicos de esta Nota de Entrega
      const nePayments: any[] = [];
      if (ne.payments && Array.isArray(ne.payments)) {
        ne.payments.forEach((alloc: any) => {
          if (alloc.payment) {
            nePayments.push({
              code: alloc.payment.code,
              amount: Number(alloc.allocatedAmount || alloc.payment.amount || 0),
              currency: alloc.payment.currency || 'USD',
              date: alloc.payment.date ? alloc.payment.date.toISOString() : new Date().toISOString(),
              method: alloc.payment.method,
              reference: alloc.payment.reference,
              account: alloc.payment.account?.name || 'Caja / Banco',
              receiptUrl: `/receipts/transaction/${alloc.payment.transactionId || alloc.payment.id}`
            });
          }
        });
      }

      nodes.push({
        id: neId,
        type: 'NOTA_ENTREGA',
        stream: 'LOGISTICS',
        code: ne.code,
        title: 'Nota de Entrega (Despacho de Almacén)',
        subtitle: `Deducción de inventario y entrega física de productos`,
        status: dispatchStatus,
        statusLabel: disp.label,
        statusBadge: disp.badge,
        date: ne.issueDate ? ne.issueDate.toISOString() : ne.createdAt.toISOString(),
        amount: Number(ne.total || 0),
        currency: ne.currency || 'USD',
        contactName: contact.name,
        contactTaxId: contact.taxId || '',
        items,
        details: {
          proyecto: ne.project?.name || 'General',
          estadoCobro: ne.status === 'PAID' ? 'Cobrada Total' : (ne.status === 'PARTIALLY_PAID' ? 'Con Abonos' : 'Pendiente de Cobro'),
          invoicedAsCode: meta.invoicedAsCode || null,
          invoicedAsId: meta.invoicedAsId || null,
          dispatchedAt: meta.dispatchedAt || null,
          deliveredAt: meta.deliveredAt || null,
          dispatchNotes: meta.dispatchNotes || null,
          pagosRegistrados: nePayments
        },
        parentId: quote ? rootNodeId : (bills.length > 0 ? `node-bill-${bills[0].code || bills[0].id}` : null),
        childrenIds: [],
        docId: ne.id,
        pdfUrl: `/backend-api/api/invoices/${ne.id}/pdf?viewMode=DELIVERY_NOTE`
      });

      // Crear nodos de pagos directos de la Nota de Entrega si existen
      nePayments.forEach((p, pIdx) => {
        const payNodeId = `node-pay-ne-${ne.code}-${pIdx}`;
        nodes.push({
          id: payNodeId,
          type: 'PAGO_COBRO',
          stream: 'FINANCIAL',
          code: p.code || `PAGO-NE-${pIdx + 1}`,
          title: 'Cobro / Abono a Nota de Entrega',
          subtitle: `Ingreso registrado vía ${p.method || 'Transferencia'} (${p.account})`,
          status: 'COMPLETED',
          statusLabel: 'Cobro Confirmado',
          statusBadge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          date: p.date,
          amount: p.amount,
          currency: p.currency,
          contactName: contact.name,
          details: {
            cuenta: p.account,
            referencia: p.reference || 'S/R',
            metodo: p.method
          },
          parentId: neId,
          childrenIds: []
        });
      });
    });

    // NODO 5: FACTURAS DE VENTA FISCALES
    salesInvoices.forEach(fac => {
      const facId = `node-fac-${fac.code || fac.id}`;
      if (!rootNodeId) rootNodeId = facId;

      const meta = parseInvoiceMeta(fac);
      const contact = resolveContact(fac, meta);
      const items = Array.isArray(meta?.items) ? meta.items.map((i: any) => ({
        name: i.name || i.description || 'Ítem Facturado',
        quantity: Number(i.quantity || 1),
        unitPrice: Number(i.unitPrice || 0),
        subtotal: Number(i.total || (i.quantity * i.unitPrice) || 0),
        unit: i.unit || 'UNIDAD'
      })) : [];

      const facStatusMap: Record<string, { label: string; badge: string }> = {
        POSTED: { label: 'Por Cobrar', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
        PARTIALLY_PAID: { label: 'Abonada Parcial', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
        PAID: { label: 'Cobrada / Pagada', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
        DRAFT: { label: 'Borrador', badge: 'bg-gray-100 text-gray-800 border-gray-300' },
        CANCELLED: { label: 'Anulada', badge: 'bg-rose-100 text-rose-800 border-rose-300' },
      };
      const st = facStatusMap[fac.status] || { label: fac.status, badge: 'bg-gray-100 text-gray-800' };

      // Buscar pagos específicos de esta Factura
      const facPayments: any[] = [];
      if (fac.payments && Array.isArray(fac.payments)) {
        fac.payments.forEach((alloc: any) => {
          if (alloc.payment) {
            facPayments.push({
              code: alloc.payment.code,
              amount: Number(alloc.allocatedAmount || alloc.payment.amount || 0),
              currency: alloc.payment.currency || 'USD',
              date: alloc.payment.date ? alloc.payment.date.toISOString() : new Date().toISOString(),
              method: alloc.payment.method,
              reference: alloc.payment.reference,
              account: alloc.payment.account?.name || 'Caja / Banco',
              receiptUrl: `/receipts/transaction/${alloc.payment.transactionId || alloc.payment.id}`
            });
          }
        });
      }

      // Si proviene de una NE específica, enlazarla
      let parentForFac = quote ? rootNodeId : null;
      if (meta.sourceDeliveryNoteCode || fac.purchaseOrder) {
        const neRef = meta.sourceDeliveryNoteCode || fac.purchaseOrder;
        const matchingNeNode = nodes.find(n => n.type === 'NOTA_ENTREGA' && n.code === neRef);
        if (matchingNeNode) {
          parentForFac = matchingNeNode.id;
        }
      }

      nodes.push({
        id: facId,
        type: 'FACTURA_VENTA',
        stream: 'COMMERCIAL',
        code: fac.code,
        title: 'Factura Fiscal Oficial de Venta',
        subtitle: `Documento formal de cobro emitido al cliente`,
        status: fac.status,
        statusLabel: st.label,
        statusBadge: st.badge,
        date: fac.issueDate ? fac.issueDate.toISOString() : fac.createdAt.toISOString(),
        amount: Number(fac.total || 0),
        currency: fac.currency || 'USD',
        contactName: contact.name,
        contactTaxId: contact.taxId || '',
        items,
        details: {
          vencimiento: fac.dueDate ? fac.dueDate.toISOString() : null,
          saldoPendiente: Number(fac.outstanding || 0),
          utilidad: fac.netProfit ? Number(fac.netProfit) : null,
          sourceDeliveryNoteCode: meta.sourceDeliveryNoteCode || null,
          pagosRegistrados: facPayments
        },
        parentId: parentForFac,
        childrenIds: [],
        docId: fac.id,
        pdfUrl: `/backend-api/api/invoices/${fac.id}/pdf`
      });

      // Crear nodos de pagos de la factura
      facPayments.forEach((p, pIdx) => {
        const payNodeId = `node-pay-fac-${fac.code}-${pIdx}`;
        nodes.push({
          id: payNodeId,
          type: 'PAGO_COBRO',
          stream: 'FINANCIAL',
          code: p.code || `PAGO-FAC-${pIdx + 1}`,
          title: 'Cobro / Abono de Factura Fiscal',
          subtitle: `Ingreso registrado en tesorería vía ${p.method || 'Transferencia'}`,
          status: 'COMPLETED',
          statusLabel: 'Conciliado en Banco',
          statusBadge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          date: p.date,
          amount: p.amount,
          currency: p.currency,
          contactName: contact.name,
          details: {
            cuenta: p.account,
            referencia: p.reference || 'S/R',
            metodo: p.method
          },
          parentId: facId,
          childrenIds: []
        });
      });
    });

    // NODO 6: REVERSOS Y DEVOLUCIONES (Logística Inversa)
    clusterInvoices.forEach(inv => {
      const meta = parseInvoiceMeta(inv);
      if (meta.returns && Array.isArray(meta.returns) && meta.returns.length > 0) {
        const parentDocId = inv.code?.toUpperCase().startsWith('NE') 
          ? `node-ne-${inv.code || inv.id}` 
          : (inv.type === 'BILL' ? `node-bill-${inv.code || inv.id}` : `node-fac-${inv.code || inv.id}`);

        meta.returns.forEach((ret: any, rIdx: number) => {
          const retNodeId = `node-ret-${ret.returnCode || `${inv.code}-RET-${rIdx + 1}`}`;
          const isCust = ret.isCustomerReturn ?? (inv.type === 'INVOICE');
          const isTot = Boolean(ret.isTotalReturn);
          const contact = resolveContact(inv, meta);

          const retItems = Array.isArray(ret.items) ? ret.items.map((it: any) => ({
            name: it.name || 'Producto devuelto',
            quantity: Number(it.quantity || 1),
            unitPrice: Number(it.unitPrice || 0),
            subtotal: Number(it.subtotal || 0),
            unit: it.unit || 'UNIDAD'
          })) : [];

          // Nodo de Devolución
          nodes.push({
            id: retNodeId,
            type: isCust ? 'DEVOLUCION_VENTA' : 'DEVOLUCION_COMPRA',
            stream: 'REVERSE',
            code: ret.returnCode,
            title: isCust ? `Devolución de Cliente (${isTot ? 'TOTAL' : 'PARCIAL'})` : `Devolución / Rechazo a Proveedor (${isTot ? 'TOTAL' : 'PARCIAL'})`,
            subtitle: isCust ? 'Mercancía retornada por cliente / Reingreso o Cuarentena' : 'Mercancía regresada a proveedor / Salida de almacén',
            status: isTot ? 'DEVUELTO_TOTAL' : 'DEVUELTO_PARCIAL',
            statusLabel: isTot ? '🔴 Devolución TOTAL' : '🟠 Devolución PARCIAL',
            statusBadge: isTot ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold' : 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
            date: ret.returnDate || ret.createdAt || new Date().toISOString(),
            amount: Number(ret.amount || 0),
            currency: ret.currency || inv.currency || 'USD',
            contactName: contact.name,
            contactTaxId: contact.taxId || '',
            items: retItems,
            details: {
              motivo: ret.reason || 'Sin motivo especificado',
              notas: ret.notes || null,
              tipoDevolucion: isTot ? 'Total' : 'Parcial',
              documentoOrigen: inv.code,
              notaCreditoAsociada: ret.creditNoteCode || null
            },
            parentId: parentDocId,
            childrenIds: []
          });

          // Si generó Nota de Crédito / Débito, crear un subnodo financiero
          if (ret.creditNoteCode) {
            const ncNodeId = `node-nc-${ret.creditNoteCode}`;
            nodes.push({
              id: ncNodeId,
              type: 'NOTA_CREDITO',
              stream: 'FINANCIAL',
              code: ret.creditNoteCode,
              title: isCust ? 'Nota de Crédito Financiera' : 'Nota de Débito / Ajuste a Proveedor',
              subtitle: isCust ? 'Ajuste de saldo a favor del cliente' : 'Disminución de cuenta por pagar a proveedor',
              status: 'EMITIDA',
              statusLabel: 'Ajuste Contable Aplicado',
              statusBadge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
              date: ret.returnDate || ret.createdAt || new Date().toISOString(),
              amount: Number(ret.amount || 0),
              currency: ret.currency || inv.currency || 'USD',
              contactName: contact.name,
              details: {
                montoAjuste: Number(ret.amount || 0),
                amparaDevolucion: ret.returnCode
              },
              parentId: retNodeId,
              childrenIds: []
            });
          }
        });
      }
    });

    // 7. Vincular childrenIds en cada nodo padre
    nodes.forEach(n => {
      if (n.parentId) {
        const parent = nodes.find(p => p.id === n.parentId);
        if (parent) {
          if (!parent.childrenIds) parent.childrenIds = [];
          if (!parent.childrenIds.includes(n.id)) {
            parent.childrenIds.push(n.id);
          }
        }
      }
    });

    // 7. Calcular Métricas de Resumen del Flujo
    const totalQuoted = quote ? Number(quote.totalUSD || quote.total || 0) : 0;
    const totalDeliveryNotes = deliveryNotes.reduce((acc, ne) => acc + Number(ne.total || 0), 0);
    const totalInvoiced = salesInvoices.reduce((acc, fac) => acc + Number(fac.total || 0), 0);
    
    // Total cobrado sumando todos los pagos únicos
    const paymentCodesSeen = new Set<string>();
    let totalCollected = 0;
    nodes.filter(n => n.type === 'PAGO_COBRO').forEach(p => {
      if (!paymentCodesSeen.has(p.code)) {
        paymentCodesSeen.add(p.code);
        totalCollected += Number(p.amount || 0);
      }
    });

    // Métricas de progreso
    const hasDelivery = deliveryNotes.some(ne => (ne.lines?.includes('DELIVERED')));
    const hasDispatched = deliveryNotes.some(ne => (ne.lines?.includes('DISPATCHED')));
    const logisticsStatus = hasDelivery ? 'Entregada al Cliente' : (hasDispatched ? 'En Tránsito / Despachada' : (deliveryNotes.length > 0 ? 'Pendiente Despacho' : 'Sin Despacho'));

    const commercialStatus = totalCollected >= (totalInvoiced || totalQuoted || totalDeliveryNotes) && totalCollected > 0
      ? 'Completamente Cobrado'
      : (totalCollected > 0 ? 'Con Abonos Registrados' : (totalInvoiced > 0 ? 'Facturado por Cobrar' : (quote ? 'Cotizado / En Evaluación' : 'En Gestión')));

    const topContact = quote?.customer?.name || (deliveryNotes.length > 0 ? resolveContact(deliveryNotes[0], parseInvoiceMeta(deliveryNotes[0])).name : 'Cliente');
    const topTaxId = quote?.customer?.taxId || (deliveryNotes.length > 0 ? resolveContact(deliveryNotes[0], parseInvoiceMeta(deliveryNotes[0])).taxId : '');

    res.json({
      success: true,
      data: {
        anchorCode: term,
        rootNodeId,
        summary: {
          clientName: topContact,
          clientTaxId: topTaxId,
          projectName: targetInvoice?.project?.name || 'General',
          totalQuoted,
          totalDeliveryNotes,
          totalInvoiced,
          totalCollected,
          currency: 'USD',
          logisticsStatus,
          commercialStatus,
          totalNodesCount: nodes.length
        },
        nodes
      }
    });

  } catch (error: any) {
    console.error('[getTraceability] Error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Error calculando trazabilidad' } });
  }
};
