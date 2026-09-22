import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { CertificationService } from '../services/certification.service';

/**
 * Endpoint para que el backend/bot/frontend registre un nuevo documento a certificar
 * POST /api/certified/register
 */
export const registerDocument = async (req: Request, res: Response) => {
  try {
    const {
      projectId,
      docCategory,
      documentNumber,
      recipientName,
      recipientPhone,
      recipientEmail,
      recipientTaxId,
      title,
      totalAmount,
      currency,
      filePath
    } = req.body;

    if (!docCategory || !documentNumber || !recipientName || !recipientPhone) {
      return res.status(400).json({
        success: false,
        error: { message: 'Campos obligatorios: docCategory, documentNumber, recipientName, recipientPhone' }
      });
    }

    let fileBuffer: Buffer | undefined;
    if (req.file) {
      fileBuffer = req.file.buffer;
    }

    const result = await CertificationService.registerCertifiedDelivery({
      projectId,
      docCategory,
      documentNumber,
      recipientName,
      recipientPhone,
      recipientEmail,
      recipientTaxId,
      title,
      totalAmount: totalAmount ? Number(totalAmount) : undefined,
      currency,
      fileBuffer,
      filePath
    });

    const whatsappText = CertificationService.generateWhatsAppMessage(
      docCategory,
      documentNumber,
      recipientName,
      result.trackingUrl
    );

    return res.status(201).json({
      success: true,
      data: {
        delivery: result.delivery,
        trackingUrl: result.trackingUrl,
        sha256: result.sha256,
        whatsappText
      }
    });
  } catch (error: any) {
    console.error('Error registrando entrega certificada:', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

/**
 * Listar entregas certificadas para el panel de auditoría
 * GET /api/certified/deliveries
 */
export const getCertifiedDeliveries = async (req: Request, res: Response) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const { category, status, search } = req.query;

    const where: any = {};
    if (category && category !== 'ALL') {
      where.docCategory = String(category);
    }
    if (status && status !== 'ALL') {
      where.status = String(status);
    }
    if (search) {
      const q = String(search).trim();
      where.OR = [
        { documentNumber: { contains: q, mode: 'insensitive' } },
        { recipientName: { contains: q, mode: 'insensitive' } },
        { recipientPhone: { contains: q, mode: 'insensitive' } }
      ];
    }

    const deliveries = await prisma.certifiedDelivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { auditLogs: true }
        }
      },
      take: 100
    });

    const publicBaseUrl = process.env.PUBLIC_API_URL || 'https://fink.grupoaludra.com';

    const enriched = deliveries.map((d: any) => ({
      ...d,
      trackingUrl: `${publicBaseUrl}/cert/v/${d.token}`,
      actaUrl: `${publicBaseUrl}/cert/acta/${d.token}`
    }));

    return res.json({ success: true, data: enriched });
  } catch (error: any) {
    console.error('Error listando entregas certificadas:', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

/**
 * Obtener detalle completo de auditoría y eventos forenses de una entrega
 * GET /api/certified/deliveries/:id
 */
export const getCertifiedDeliveryDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const delivery = await prisma.certifiedDelivery.findFirst({
      where: {
        OR: [
          { id },
          { token: id },
          { documentNumber: id }
        ]
      },
      include: {
        auditLogs: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!delivery) {
      return res.status(404).json({ success: false, error: { message: 'Certificación no encontrada' } });
    }

    const publicBaseUrl = process.env.PUBLIC_API_URL || 'https://fink.grupoaludra.com';

    return res.json({
      success: true,
      data: {
        ...delivery,
        trackingUrl: `${publicBaseUrl}/cert/v/${delivery.token}`,
        actaUrl: `${publicBaseUrl}/cert/acta/${delivery.token}`
      }
    });
  } catch (error: any) {
    console.error('Error obteniendo detalle de entrega certificada:', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

/**
 * Genera o recupera certificación directamente desde el ID de una Factura / Nota de Entrega / OC
 * POST /api/certified/certify-invoice/:id
 */
export const certifyInvoiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        project: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: { message: 'Factura/documento no encontrado' } });
    }

    // Verificar si ya existe una entrega para este documento
    const existing = await prisma.certifiedDelivery.findFirst({
      where: { documentNumber: invoice.code },
      orderBy: { createdAt: 'desc' }
    });

    if (existing) {
      const publicBaseUrl = process.env.PUBLIC_API_URL || 'https://fink.grupoaludra.com';
      const trackingUrl = `${publicBaseUrl}/cert/v/${existing.token}`;
      const whatsappText = CertificationService.generateWhatsAppMessage(
        existing.docCategory,
        existing.documentNumber,
        existing.recipientName,
        trackingUrl
      );

      return res.json({
        success: true,
        data: {
          delivery: existing,
          trackingUrl,
          sha256: existing.fileHashSha256,
          whatsappText
        }
      });
    }

    // Si no existe, determinar tipo y generar PDF
    const isDelivery = invoice.code.toUpperCase().startsWith('NE');
    const isOC = invoice.code.toUpperCase().startsWith('OC-') || invoice.type === 'BILL';
    let docCategory: 'INVOICE' | 'DELIVERY_NOTE' | 'PURCHASE_ORDER' = 'INVOICE';
    if (isDelivery) docCategory = 'DELIVERY_NOTE';
    else if (isOC) docCategory = 'PURCHASE_ORDER';

    let contact: any = null;
    const contactId = invoice.vendorId || invoice.customerId;
    if (contactId) {
      contact = await prisma.contactPerson.findUnique({ where: { id: contactId } });
    }

    const recipientName = contact?.name || (invoice as any).clientName || 'CLIENTE ESTIMADO';
    const recipientPhone = contact?.phone || '';

    // Generar buffer usando el servicio correspondiente
    let pdfBuffer: Buffer;
    if (isDelivery) {
      const { generateDeliveryNotePDFBuffer } = require('../services/deliveryNotePdf.service');
      let parsedLines: any = { items: [] };
      try {
        if (invoice.lines) {
          parsedLines = typeof invoice.lines === 'string' ? JSON.parse(invoice.lines) : invoice.lines;
        }
      } catch (_) {}
      const itemsList = Array.isArray(parsedLines) ? parsedLines : (parsedLines.items || []);

      const { buffer } = await generateDeliveryNotePDFBuffer({
        noteNumber: invoice.code,
        clientName: recipientName,
        clientTaxId: contact?.taxId || '',
        clientPhone: recipientPhone,
        clientEmail: contact?.email || '',
        clientAddress: contact?.address || '',
        companyName: invoice.project?.name || 'Inversiones Lucem C.A.',
        companyTaxId: 'J-40500250-6',
        items: itemsList.map((it: any) => ({
          sku: it.sku || '',
          description: it.name || it.description || 'Producto',
          quantity: Number(it.quantity || 1),
          unit: it.unit || 'UNIDAD',
          unitPrice: Number(it.unitPrice || 0),
          total: Number(it.total || 0)
        })),
        tasaBCV: 832.48
      });
      pdfBuffer = buffer;
    } else if (isOC) {
      const { generatePurchaseOrderPDFBuffer } = require('../services/purchaseOrderPdf.service');
      let parsedLines: any = { items: [] };
      try {
        if (invoice.lines) {
          parsedLines = typeof invoice.lines === 'string' ? JSON.parse(invoice.lines) : invoice.lines;
        }
      } catch (_) {}
      const itemsList = Array.isArray(parsedLines) ? parsedLines : (parsedLines.items || []);

      const { buffer } = await generatePurchaseOrderPDFBuffer({
        orderNumber: invoice.code,
        supplierName: recipientName,
        supplierTaxId: contact?.taxId || 'J-00000000-0',
        supplierPhone: recipientPhone,
        companyName: invoice.project?.name || 'Inversiones Lucem C.A.',
        companyTaxId: 'J-40500250-6',
        items: itemsList.map((it: any) => ({
          sku: it.sku || '',
          name: it.name || it.description || 'Producto',
          quantity: Number(it.quantity || 1),
          unit: it.unit || 'UNIDAD',
          costPrice: Number(it.unitPrice || 0)
        })),
        tasaBCV: 832.48
      });
      pdfBuffer = buffer;
    } else {
      // Factura tradicional: generar un PDF con encabezado y tabla institucional
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: any) => chunks.push(c));
      
      doc.rect(40, 40, doc.page.width - 80, 50).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
         .text(`FACTURA DIGITAL - ${invoice.code}`, 55, 52);
      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
         .text(`Emisor: ${invoice.project?.name || 'Inversiones Lucem C.A.'} | RIF: J-40500250-6`, 55, 70);

      doc.fillColor('#0f172a').fontSize(10).font('Helvetica')
         .text(`Cliente: ${recipientName}`, 45, 110)
         .text(`Fecha: ${new Date(invoice.issueDate).toLocaleDateString('es-VE')}`, 45, 125)
         .text(`Total: $${invoice.total.toFixed(2)}`, 45, 140);

      doc.end();
      pdfBuffer = await new Promise((resBuff) => doc.on('end', () => resBuff(Buffer.concat(chunks))));
    }

    const result = await CertificationService.registerCertifiedDelivery({
      projectId: invoice.projectId,
      docCategory,
      documentNumber: invoice.code,
      recipientName,
      recipientPhone,
      recipientEmail: contact?.email,
      recipientTaxId: contact?.taxId,
      totalAmount: invoice.total,
      currency: invoice.currency || 'USD',
      fileBuffer: pdfBuffer
    });

    const whatsappText = CertificationService.generateWhatsAppMessage(
      docCategory,
      invoice.code,
      recipientName,
      result.trackingUrl
    );

    return res.status(201).json({
      success: true,
      data: {
        delivery: result.delivery,
        trackingUrl: result.trackingUrl,
        sha256: result.sha256,
        whatsappText
      }
    });
  } catch (error: any) {
    console.error('Error certificando factura por ID:', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

/**
 * Sirve la página web del visor móvil responsivo con el botón de confirmación
 * GET /cert/v/:token
 */
export const renderCertifiedViewer = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    const delivery = await CertificationService.getDeliveryAndRecordView(token, ip, userAgent);

    if (!delivery) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8"><title>Documento no encontrado</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }
            .card { background: #1e293b; padding: 30px; border-radius: 16px; max-width: 420px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            h2 { color: #f87171; margin-top: 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>⚠️ Documento no encontrado</h2>
            <p>El enlace que estás intentando abrir no existe o ha expirado.</p>
          </div>
        </body>
        </html>
      `);
    }

    const friendlyCategory = CertificationService.getFriendlyCategoryName(delivery.docCategory);
    const actionVerb = CertificationService.getActionVerb(delivery.docCategory);
    const isConfirmed = delivery.status === 'CONFIRMED';
    const confirmedDateStr = delivery.confirmedAt ? new Date(delivery.confirmedAt).toLocaleString('es-VE') : '';

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${friendlyCategory} - ${delivery.documentNumber}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body { background-color: #0b1120; color: #f8fafc; display: flex; flex-direction: column; min-height: 100vh; }
    
    /* Header */
    header { background: #0f172a; border-bottom: 1px solid #1e293b; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
    .brand-title { font-size: 14px; font-weight: 700; letter-spacing: 0.5px; color: #38bdf8; text-transform: uppercase; }
    .badge-status { font-size: 11px; padding: 4px 10px; border-radius: 9999px; font-weight: 600; text-transform: uppercase; }
    .badge-pending { background: #ca8a04; color: #fef08a; }
    .badge-confirmed { background: #15803d; color: #bbf7d0; }

    /* Metadata Bar */
    .meta-bar { background: #1e293b; padding: 12px 20px; font-size: 13px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #334155; }
    .meta-item span { color: #94a3b8; }
    .meta-item strong { color: #ffffff; }

    /* PDF Viewer Container */
    .viewer-container { flex: 1; display: flex; flex-direction: column; position: relative; background: #334155; }
    iframe { width: 100%; height: 100%; flex: 1; border: none; min-height: 60vh; }

    /* Action Footer */
    footer { background: #0f172a; border-top: 1px solid #1e293b; padding: 16px 20px; position: sticky; bottom: 0; z-index: 50; box-shadow: 0 -4px 20px rgba(0,0,0,0.4); }
    .action-row { display: flex; gap: 12px; max-width: 600px; margin: 0 auto; }
    .btn { flex: 1; padding: 14px 18px; border-radius: 10px; font-size: 15px; font-weight: 600; text-align: center; text-decoration: none; cursor: pointer; border: none; transition: all 0.2s ease; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-confirm { background: #22c55e; color: #022c22; }
    .btn-confirm:hover { background: #16a34a; }
    .btn-download { background: #334155; color: #f8fafc; }
    .btn-download:hover { background: #475569; }
    
    .confirmed-banner { text-align: center; padding: 12px; background: rgba(34, 197, 94, 0.15); border: 1px solid #22c55e; border-radius: 10px; color: #4ade80; font-size: 14px; font-weight: 500; }
    .cert-hash { font-size: 10px; color: #64748b; text-align: center; margin-top: 8px; word-break: break-all; }
  </style>
</head>
<body>

  <header>
    <div class="brand-title">Grupo Aludra • Lucem</div>
    <div id="statusBadge" class="badge-status ${isConfirmed ? 'badge-confirmed' : 'badge-pending'}">
      ${isConfirmed ? '✓ CONFIRMADO' : 'PENDIENTE POR CONFIRMAR'}
    </div>
  </header>

  <div class="meta-bar">
    <div class="meta-item"><span>Documento:</span> <strong>${friendlyCategory} ${delivery.documentNumber}</strong></div>
    <div class="meta-item"><span>Destinatario:</span> <strong>${delivery.recipientName}</strong></div>
    ${delivery.totalAmount ? `<div class="meta-item"><span>Total:</span> <strong>$${delivery.totalAmount.toFixed(2)}</strong></div>` : ''}
  </div>

  <div class="viewer-container">
    <iframe src="/cert/file/${delivery.token}#toolbar=0" title="${delivery.title}"></iframe>
  </div>

  <footer>
    <div class="action-row" id="actionArea">
      ${isConfirmed ? `
        <div style="width: 100%;">
          <div class="confirmed-banner">
            ✅ Recepción confirmada el ${confirmedDateStr}
          </div>
          <div style="margin-top: 10px; display: flex; justify-content: center;">
            <a href="/cert/file/${delivery.token}?download=1" class="btn btn-download" style="width: 100%;">
              📥 Descargar Copia Oficial en PDF
            </a>
          </div>
        </div>
      ` : `
        <button id="btnConfirm" class="btn btn-confirm" onclick="confirmReceipt()">
          ✅ ${actionVerb}
        </button>
        <a href="/cert/file/${delivery.token}?download=1" class="btn btn-download">
          📥 Descargar
        </a>
      `}
    </div>
    <div class="cert-hash">
      Huella SHA-256: ${delivery.fileHashSha256}
    </div>
  </footer>

  <script>
    async function confirmReceipt() {
      const btn = document.getElementById('btnConfirm');
      btn.disabled = true;
      btn.innerText = '⏳ Procesando confirmación...';

      try {
        const res = await fetch('/cert/confirm/${delivery.token}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timestamp: new Date().toISOString() })
        });

        const data = await res.json();
        if (data.success) {
          document.getElementById('statusBadge').className = 'badge-status badge-confirmed';
          document.getElementById('statusBadge').innerText = '✓ CONFIRMADO';
          document.getElementById('actionArea').innerHTML = \`
            <div style="width: 100%;">
              <div class="confirmed-banner">
                ✅ Recepción confirmada con éxito. ¡Gracias por tu confirmación!
              </div>
              <div style="margin-top: 10px; display: flex; justify-content: center;">
                <a href="/cert/file/${delivery.token}?download=1" class="btn btn-download" style="width: 100%;">
                  📥 Descargar Copia Oficial en PDF
                </a>
              </div>
            </div>
          \`;
        } else {
          alert('Hubo un inconveniente al confirmar. Por favor intenta nuevamente.');
          btn.disabled = false;
          btn.innerText = '✅ ${actionVerb}';
        }
      } catch (err) {
        alert('Error de conexión.');
        btn.disabled = false;
        btn.innerText = '✅ ${actionVerb}';
      }
    }
  </script>
</body>
</html>
    `;

    return res.send(html);
  } catch (error: any) {
    console.error('Error sirviendo visor certificado:', error);
    return res.status(500).send('Error interno cargando el visor.');
  }
};

/**
 * Sirve el archivo PDF directamente
 * GET /cert/file/:token
 */
export const serveCertifiedFile = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const download = req.query.download === '1';

    const delivery = await CertificationService.getDeliveryAndRecordView(token);
    if (!delivery) {
      return res.status(404).send('Archivo no encontrado');
    }

    const fullPath = path.isAbsolute(delivery.fileUrl)
      ? delivery.fileUrl
      : path.join(process.cwd(), delivery.fileUrl);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).send('El archivo físico del documento no fue encontrado.');
    }

    const filename = `${delivery.docCategory}_${delivery.documentNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      download ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`
    );

    return res.sendFile(fullPath);
  } catch (error: any) {
    console.error('Error sirviendo PDF certificado:', error);
    return res.status(500).send('Error leyendo el archivo.');
  }
};

/**
 * Endpoint de confirmación
 * POST /cert/confirm/:token
 */
export const confirmCertifiedReceipt = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { clientNotes } = req.body;
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    const updated = await CertificationService.confirmDelivery(token, clientNotes, ip, userAgent);

    return res.json({
      success: true,
      data: {
        status: updated.status,
        confirmedAt: updated.confirmedAt,
        documentNumber: updated.documentNumber
      }
    });
  } catch (error: any) {
    console.error('Error al confirmar recepción:', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

/**
 * Descarga el Acta oficial en PDF del certificado de auditoría
 * GET /cert/acta/:token
 */
export const downloadCertificatePDF = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const delivery = await CertificationService.getDeliveryAndRecordView(token);
    if (!delivery) {
      return res.status(404).send('Documento no encontrado');
    }

    const { generateCertificationAuditReportPDF } = require('../services/certificationReportPdf.service');
    const pdfBuffer = await generateCertificationAuditReportPDF(delivery.id);

    const filename = `Acta_Certificacion_${delivery.docCategory}_${delivery.documentNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error('Error generando acta de certificación:', error);
    return res.status(500).send('Error generando acta de certificación');
  }
};
