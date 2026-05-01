import prisma from '../config/database';
import { sendWhatsAppNotification } from './whatsapp.service';

/**
 * Servicio de gestión de documentos
 */

/**
 * Verificar documentos por vencer y enviar alertas
 */
export const checkDueDocuments = async (): Promise<void> => {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Buscar documentos que vencen en los próximos 7 días
    const dueSoonDocuments = await prisma.document.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          gte: now,
          lte: sevenDaysFromNow
        }
      },
      include: {
        project: true,
        user: true
      }
    });

    console.log(`📄 Found ${dueSoonDocuments.length} documents due soon`);

    for (const doc of dueSoonDocuments) {
      const daysUntilDue = Math.floor(
        (doc.dueDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const message = `
⚠️ *Documento por Vencer*

📄 *${doc.title}*
🏢 Proyecto: ${doc.project.name}
📅 Vence en: ${daysUntilDue} día(s)
💰 Monto: ${doc.amount} ${doc.currency}
${doc.thirdParty ? `👤 Tercero: ${doc.thirdParty}` : ''}

Código: ${doc.code}
      `.trim();

      // Crear notificación en la app
      await prisma.notification.create({
        data: {
          type: 'DOCUMENT_DUE',
          channel: 'IN_APP',
          title: 'Documento por vencer',
          message: `${doc.title} vence en ${daysUntilDue} días`,
          data: JSON.stringify({
            documentId: doc.id,
            projectId: doc.projectId,
            daysUntilDue
          }),
          userId: doc.userId
        }
      });

      // Enviar por WhatsApp si está configurado
      try {
        await sendWhatsAppNotification(message, doc.userId);
        
        await prisma.notification.create({
          data: {
            type: 'DOCUMENT_DUE',
            channel: 'WHATSAPP',
            title: 'Documento por vencer',
            message,
            data: JSON.stringify({ documentId: doc.id }),
            userId: doc.userId,
            isSent: true,
            sentAt: new Date()
          }
        });
      } catch (whatsappError) {
        console.error('❌ Error sending WhatsApp notification:', whatsappError);
      }
    }

    // Buscar documentos vencidos
    const overdueDocuments = await prisma.document.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          lt: now
        }
      }
    });

    // Actualizar estado a OVERDUE
    if (overdueDocuments.length > 0) {
      await prisma.document.updateMany({
        where: {
          id: {
            in: overdueDocuments.map(d => d.id)
          }
        },
        data: {
          status: 'OVERDUE'
        }
      });

      console.log(`📄 Updated ${overdueDocuments.length} documents to OVERDUE status`);
    }
  } catch (error) {
    console.error('❌ Error checking due documents:', error);
  }
};

/**
 * Obtener resumen de documentos
 */
export const getDocumentsSummary = async (projectId: string) => {
  try {
    const summary = await prisma.document.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true,
      _sum: {
        amount: true,
        amountPaid: true
      }
    });

    return summary;
  } catch (error) {
    console.error('❌ Error getting documents summary:', error);
    return [];
  }
};
