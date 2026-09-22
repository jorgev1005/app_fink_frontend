import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function generateCertificationAuditReportPDF(deliveryId: string): Promise<Buffer> {
  const delivery = await prisma.certifiedDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      auditLogs: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!delivery) {
    throw new Error('Entrega no encontrada para generar acta de certificación.');
  }

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Acta de Certificación - ${delivery.documentNumber}`,
          Author: 'Grupo Aludra • Lucem'
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width - 80;
      const LEFT = 40;
      let y = 40;

      // Encabezado
      doc.rect(LEFT, y, W, 50).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
         .text('ACTA DE NOTIFICACIÓN Y CERTIFICACIÓN DIGITAL', LEFT + 15, y + 12, { width: W - 30, align: 'left' });
      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
         .text('Evidencia pericial de entrega fehaciente, trazabilidad e integridad de documento', LEFT + 15, y + 30);

      y += 65;

      // Resumen del Documento
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
         .text('1. Datos del Documento Certificado', LEFT, y);
      y += 18;

      doc.rect(LEFT, y, W, 70).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#334155').fontSize(9).font('Helvetica');

      const col1 = LEFT + 15;
      const col2 = LEFT + (W / 2) + 10;
      let dataY = y + 10;

      doc.text(`Tipo de Documento: `, col1, dataY, { continued: true })
         .font('Helvetica-Bold').text(delivery.docCategory);
      doc.font('Helvetica').text(`Número: `, col2, dataY, { continued: true })
         .font('Helvetica-Bold').text(delivery.documentNumber);

      dataY += 16;
      doc.font('Helvetica').text(`Destinatario: `, col1, dataY, { continued: true })
         .font('Helvetica-Bold').text(delivery.recipientName);
      doc.font('Helvetica').text(`Teléfono: `, col2, dataY, { continued: true })
         .font('Helvetica-Bold').text(delivery.recipientPhone);

      dataY += 16;
      doc.font('Helvetica').text(`Estado Actual: `, col1, dataY, { continued: true })
         .font('Helvetica-Bold').fillColor(delivery.status === 'CONFIRMED' ? '#16a34a' : '#ca8a04')
         .text(delivery.status);

      y += 85;

      // Integridad Criptográfica
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
         .text('2. Integridad Criptográfica del Archivo Original', LEFT, y);
      y += 18;

      doc.rect(LEFT, y, W, 45).fillAndStroke('#f1f5f9', '#cbd5e1');
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
         .text('Huella digital inmutable (SHA-256):', LEFT + 12, y + 8);
      doc.fillColor('#0f172a').fontSize(9).font('Courier-Bold')
         .text(delivery.fileHashSha256, LEFT + 12, y + 22, { width: W - 24 });

      y += 60;

      // Línea de tiempo de eventos auditados
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
         .text('3. Pista de Auditoría Forense (Línea de Tiempo)', LEFT, y);
      y += 18;

      // Tabla de eventos
      doc.rect(LEFT, y, W, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('FECHA Y HORA (UTC)', LEFT + 10, y + 6, { width: 130 });
      doc.text('EVENTO', LEFT + 145, y + 6, { width: 100 });
      doc.text('DIRECCIÓN IP', LEFT + 250, y + 6, { width: 90 });
      doc.text('DETALLES / AGENTE', LEFT + 345, y + 6, { width: W - 355 });
      y += 20;

      delivery.auditLogs.forEach((log: any, idx: number) => {
        const rowBg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(LEFT, y, W, 22).fill(rowBg);

        doc.fillColor('#334155').fontSize(7.5).font('Helvetica');
        const dateFormatted = new Date(log.createdAt).toLocaleString('es-VE', { timeZone: 'America/Caracas' });
        doc.text(dateFormatted, LEFT + 10, y + 6, { width: 130 });
        
        doc.font('Helvetica-Bold')
           .fillColor(log.eventType === 'CONFIRMED' ? '#15803d' : '#0f172a')
           .text(log.eventType, LEFT + 145, y + 6, { width: 100 });

        doc.font('Helvetica').fillColor('#64748b')
           .text(log.ipAddress || 'Interno / Servidor', LEFT + 250, y + 6, { width: 90 });

        const shortUA = (log.userAgent || log.payload || '-').slice(0, 40);
        doc.text(shortUA, LEFT + 345, y + 6, { width: W - 355, ellipsis: true });

        y += 22;
      });

      y += 25;

      // Código QR de verificación en línea
      const publicBaseUrl = process.env.PUBLIC_API_URL || 'https://fink.grupoaludra.com';
      const verifyUrl = `${publicBaseUrl}/cert/v/${delivery.token}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 90 });
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

      doc.image(qrBuffer, LEFT, y, { width: 65 });
      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold')
         .text('Verificación Digital en Línea', LEFT + 75, y + 8);
      doc.fillColor('#64748b').fontSize(8).font('Helvetica')
         .text('Escanee este código QR para comprobar la autenticidad de esta acta y acceder al registro original almacenado en los servidores de Grupo Aludra.', LEFT + 75, y + 22, { width: W - 80 });

      // Footer
      y = doc.page.height - 35;
      doc.moveTo(LEFT, y).lineTo(LEFT + W, y).strokeColor('#cbd5e1').stroke();
      doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
         .text(`Acta generada automáticamente por Sistema FINK | ID: ${delivery.id} | Token: ${delivery.token}`, LEFT, y + 8, { width: W, align: 'center' });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
