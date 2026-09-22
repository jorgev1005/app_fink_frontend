import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateDeliveryParams {
  projectId?: string;
  docCategory: 'INVOICE' | 'QUOTATION' | 'DELIVERY_NOTE' | 'PURCHASE_ORDER';
  documentNumber: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string;
  recipientTaxId?: string;
  title?: string;
  totalAmount?: number;
  currency?: string;
  fileBuffer?: Buffer;
  filePath?: string;
}

export class CertificationService {
  /**
   * Calcula el Hash SHA-256 de un archivo o buffer (huella digital inmutable)
   */
  static computeSha256(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Guarda un documento emitido y genera su token único de certificación
   */
  static async registerCertifiedDelivery(params: CreateDeliveryParams) {
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
      currency = 'USD',
      fileBuffer,
      filePath
    } = params;

    let bufferToHash: Buffer;
    let finalRelativePath: string;

    // Directorio de almacenamiento seguro
    const storageDir = path.join(process.cwd(), 'uploads', 'certified_docs');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const cleanDocNumber = documentNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFileName = `${docCategory}_${cleanDocNumber}_${Date.now()}.pdf`;
    const targetDiskPath = path.join(storageDir, safeFileName);

    if (fileBuffer) {
      bufferToHash = fileBuffer;
      fs.writeFileSync(targetDiskPath, fileBuffer);
      finalRelativePath = path.join('uploads', 'certified_docs', safeFileName);
    } else if (filePath && fs.existsSync(filePath)) {
      bufferToHash = fs.readFileSync(filePath);
      fs.copyFileSync(filePath, targetDiskPath);
      finalRelativePath = path.join('uploads', 'certified_docs', safeFileName);
    } else {
      throw new Error('Se requiere un buffer de archivo o ruta válida para certificar el documento.');
    }

    const fileHashSha256 = this.computeSha256(bufferToHash);

    // Registro en la base de datos
    const delivery = await prisma.certifiedDelivery.create({
      data: {
        projectId,
        docCategory,
        documentNumber,
        recipientName,
        recipientPhone,
        recipientEmail,
        recipientTaxId,
        title: title || `${this.getFriendlyCategoryName(docCategory)} ${documentNumber}`,
        totalAmount,
        currency,
        fileUrl: finalRelativePath,
        fileHashSha256,
        status: 'SENT',
        sentAt: new Date(),
        auditLogs: {
          create: {
            eventType: 'GENERATED_AND_SENT',
            payload: JSON.stringify({
              sha256: fileHashSha256,
              fileName: safeFileName,
              bytes: bufferToHash.length
            })
          }
        }
      }
    });

    const publicBaseUrl = process.env.PUBLIC_API_URL || 'https://fink.grupoaludra.com';
    const trackingUrl = `${publicBaseUrl}/cert/v/${delivery.token}`;

    return {
      delivery,
      trackingUrl,
      sha256: fileHashSha256
    };
  }

  /**
   * Obtiene la entrega por token y registra la visualización
   */
  static async getDeliveryAndRecordView(token: string, ipAddress?: string, userAgent?: string) {
    const delivery = await prisma.certifiedDelivery.findUnique({
      where: { token }
    });

    if (!delivery) {
      return null;
    }

    // Actualizar firstViewedAt si es la primera vez
    const updates: any = {};
    if (!delivery.firstViewedAt) {
      updates.firstViewedAt = new Date();
      if (delivery.status === 'SENT') {
        updates.status = 'VIEWED';
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.certifiedDelivery.update({
        where: { id: delivery.id },
        data: updates
      });
    }

    // Log de auditoría
    await prisma.certifiedAuditLog.create({
      data: {
        deliveryId: delivery.id,
        eventType: 'VIEWED',
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        payload: JSON.stringify({
          timestamp: new Date().toISOString()
        })
      }
    });

    return delivery;
  }

  /**
   * Procesa la confirmación explícita del cliente
   */
  static async confirmDelivery(token: string, clientNotes?: string, ipAddress?: string, userAgent?: string) {
    const delivery = await prisma.certifiedDelivery.findUnique({
      where: { token }
    });

    if (!delivery) {
      throw new Error('Documento no encontrado o enlace inválido.');
    }

    const updated = await prisma.certifiedDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        clientNotes: clientNotes || delivery.clientNotes
      }
    });

    await prisma.certifiedAuditLog.create({
      data: {
        deliveryId: delivery.id,
        eventType: 'CONFIRMED',
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        payload: JSON.stringify({
          confirmedAt: updated.confirmedAt,
          clientNotes: clientNotes || null
        })
      }
    });

    return updated;
  }

  /**
   * Genera el texto estándar para enviar por WhatsApp
   */
  static generateWhatsAppMessage(category: string, docNumber: string, recipientName: string, trackingUrl: string): string {
    const catName = this.getFriendlyCategoryName(category);
    return `Hola *${recipientName}*, un gusto saludarte. 👋\n\n` +
      `Te compartimos tu *${catName} N° ${docNumber}* con certificación digital.\n\n` +
      `📄 Puedes revisar el documento y *confirmar su recepción* directamente aquí:\n` +
      `👉 ${trackingUrl}\n\n` +
      `_Este enlace es seguro y cuenta con trazabilidad técnica inmutable._`;
  }

  static getFriendlyCategoryName(category: string): string {
    switch (category) {
      case 'INVOICE':
        return 'Factura Digital';
      case 'QUOTATION':
        return 'Cotización';
      case 'DELIVERY_NOTE':
        return 'Nota de Entrega';
      case 'PURCHASE_ORDER':
        return 'Orden de Compra';
      default:
        return 'Documento';
    }
  }

  static getActionVerb(category: string): string {
    switch (category) {
      case 'INVOICE':
        return 'Confirmar Recepción de Factura';
      case 'QUOTATION':
        return 'Aprobar Cotización';
      case 'DELIVERY_NOTE':
        return 'Recibí Mercancía Conforme';
      case 'PURCHASE_ORDER':
        return 'Aceptar Orden de Compra';
      default:
        return 'Confirmar Recepción';
    }
  }
}
