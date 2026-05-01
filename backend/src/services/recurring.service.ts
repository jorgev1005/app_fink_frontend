import prisma from '../config/database';
import { processInvoicePosting } from './invoice.service';

import { createNotification } from './notification.service';

// Compute next occurrence given frequency and interval
const computeNext = (current: Date, frequency: string, interval: number) => {
  const d = new Date(current);
  if (frequency === 'DAILY') {
    d.setDate(d.getDate() + interval);
    return d;
  }
  if (frequency === 'WEEKLY') {
    d.setDate(d.getDate() + interval * 7);
    return d;
  }
  if (frequency === 'MONTHLY') {
    const month = d.getMonth();
    d.setMonth(month + interval);
    return d;
  }
  if (frequency === 'YEARLY') {
    d.setFullYear(d.getFullYear() + interval);
    return d;
  }
  return d;
};

/**
 * Process recurring rules whose `nextRunAt` is due (<= now).
 * For each rule we:
 *  - create a ScheduledOccurrence (PENDING)
 *  - create Invoice from entriesTemplate
 *  - link occurrence -> invoice and mark POSTED
 *  - advance nextRunAt
 *
 * The function will attempt to catch up multiple missed runs (up to a safety limit).
 */
export const processDueRecurringRules = async (): Promise<void> => {
  try {
    const now = new Date();

    // find rules that are active and due
    const dueRules = await prisma.recurringRule.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now }
      }
    });

    if (!dueRules.length) {
      console.log('🔁 No recurring rules due at this time');
      return;
    }

    console.log(`🔁 Found ${dueRules.length} recurring rule(s) due`);

    const exchangeRate = await prisma.exchangeRate.findFirst({
      orderBy: { date: 'desc' }
    });
    
    const rateUsdToBs = exchangeRate?.usdToBs || 1;
    const rateEurToBs = exchangeRate?.eurToBs || 1;
    const rateEurToUsd = exchangeRate?.eurToUsd || 1;


    for (const rule of dueRules) {
      try {
        // Safety: if many missed runs, don't loop forever. Limit iterations.
        let iterations = 0;
        const maxRuns = 12;

        // Work on a local copy of nextRunAt to potentially create multiple occurrences
        let nextRun = rule.nextRunAt ? new Date(rule.nextRunAt) : new Date();

        while (nextRun <= now && iterations < maxRuns) {
          iterations++;

          // create scheduled occurrence (PENDING)
          const occurrence = await prisma.scheduledOccurrence.create({
            data: {
              recurringRule: { connect: { id: rule.id } },
              scheduledFor: nextRun,
              status: 'PENDING'
            }
          });

          // Crear transacción directa en vez de factura
          const contactId = (rule as any).contactId;
          const shortCode = `TRX-${Date.now().toString().slice(-8)}`;

          // Parse entriesTemplate para obtener cuentas y descripción
          let entries: any[] = [];
          let description = rule.name || 'Transacción recurrente';
          try {
            const parsed = typeof rule.entriesTemplate === 'string' ? JSON.parse(rule.entriesTemplate) : rule.entriesTemplate;
            if (Array.isArray(parsed)) {
              entries = parsed.map((e: any) => ({
                debitAccountId: e.debitAccountId,
                creditAccountId: e.creditAccountId,
                debitAmount: e.debitAmount,
                creditAmount: e.creditAmount,
                description: e.description || description
              }));
              if (parsed[0]?.description) description = parsed[0].description;
            }
          } catch (e) {
            entries = [];
          }

          
          let amountBs = 0;
          let amountUsd = 0;
          let amountEur = 0;
          const curr = rule.currency || 'USD';
          const amt = Number(rule.amount) || 0;

          if (curr === 'BS') {
            amountBs = amt;
            amountUsd = rateUsdToBs ? amt / rateUsdToBs : 0;
            amountEur = rateEurToBs ? amt / rateEurToBs : 0;
          } else if (curr === 'USD') {
            amountUsd = amt;
            amountBs = amt * rateUsdToBs;
            amountEur = rateEurToUsd ? amt / rateEurToUsd : 0;
          } else if (curr === 'EUR') {
            amountEur = amt;
            amountBs = amt * rateEurToBs;
            amountUsd = amt * rateEurToUsd;
          }

          amountBs = isNaN(amountBs) || !isFinite(amountBs) ? 0 : amountBs;
          amountUsd = isNaN(amountUsd) || !isFinite(amountUsd) ? 0 : amountUsd;
          amountEur = isNaN(amountEur) || !isFinite(amountEur) ? 0 : amountEur;

          const trx = await prisma.transaction.create({

            data: {
              project: { connect: { id: rule.projectId } },
              code: shortCode,
              type: (rule as any).type === 'INVOICE' ? 'INCOME' : ((rule as any).type === 'BILL' ? 'EXPENSE' : (rule as any).type || 'EXPENSE'),
              date: nextRun,
              currency: rule.currency,
              amount: rule.amount,
              description,
              ...(contactId ? { contactPerson: { connect: { id: contactId } } } : {}),

              amountBs,
              amountUsd,
              amountEur,
              entries: {
                create: entries.length > 0 ? entries : [
                  {
                    debitAmount: rule.amount,
                    creditAmount: rule.amount,
                    description
                  }
                ]
              },
              user: { connect: { id: rule.createdBy } },
              status: 'PENDING',
              paymentStatus: 'PENDING',
              tags: '[]',
              attachments: '[]',
            }
          });

          // compute newNext and update rule + occurrence in una transacción
          const newNext = computeNext(nextRun, rule.frequency, rule.interval);

          await prisma.$transaction([
            prisma.recurringRule.update({ where: { id: rule.id }, data: { nextRunAt: newNext } }),
            prisma.scheduledOccurrence.update({ where: { id: occurrence.id }, data: { status: 'POSTED' } })
          ]);

          // Crear notificación
          await createNotification(
            `Nueva Transacción Recurrente: ${rule.name}`,
            `Se ha generado automáticamente la transacción ${trx.code} por ${rule.amount} ${rule.currency}.`,
            'TRANSACTION_GENERATED',
            rule.createdBy, // Asignar al creador de la regla
            { transactionId: trx.id, ruleId: rule.id }
          );

          console.log(`✅ Processed recurring rule ${rule.id} for ${nextRun.toISOString()} (transacción directa)`);

          // advance for next iteration
          nextRun = new Date(newNext);
        }

        if (iterations >= maxRuns) {
          console.warn(`⚠️ Reached maxRuns (${maxRuns}) when processing rule ${rule.id}; manual review recommended.`);
        }
      } catch (err) {
        console.error(`❌ Error processing recurring rule ${rule.id}:`, err);
      }
    }
  } catch (error) {
    console.error('❌ Error in processDueRecurringRules:', error);
  }
};

export default processDueRecurringRules;
