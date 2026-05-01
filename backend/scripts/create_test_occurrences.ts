import dotenv from 'dotenv';
import prisma from '../src/config/database';

dotenv.config();

async function run() {
  try {
    const user = await prisma.user.findFirst();
    const project = await prisma.project.findFirst();
    if (!user || !project) {
      console.error('Necesitas al menos un `User` y un `Project` en la base de datos. Crea uno primero.');
      process.exit(1);
    }

    const invoices: any[] = [];
    const now = new Date();

    // Asegurar que exista una RecurringRule para el project (recurringRuleId es requerido en ScheduledOccurrence)
    let rule = await prisma.recurringRule.findFirst({ where: { projectId: project.id } });
    if (!rule) {
      rule = await prisma.recurringRule.create({
        data: {
          project: { connect: { id: project.id } },
          name: 'Regla test creada por script',
          description: 'Regla temporal para crear ocurrencias de prueba',
          amount: 0,
          currency: 'USD',
          entriesTemplate: [],
          frequency: 'MONTHLY',
          interval: 1,
          startDate: now,
          nextRunAt: now,
          createdBy: user.id
        }
      });
      console.log('Se creó RecurringRule de prueba:', rule.id);
    }

    for (let i = 0; i < 10; i++) {
      const total = 100 + i * 10;
      // 3 primeros vencidas (dueDate en el pasado), los otros en futuro
      const offsetDays = (i < 3) ? -(5 + i) : (5 + i);
      const dueDate = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);

      const inv = await prisma.invoice.create({
        data: {
          project: { connect: { id: project.id } },
          code: `TEST-INV-${Date.now()}-${i}`,
          type: 'BILL',
          issueDate: now,
          dueDate,
          currency: 'USD',
          total,
          outstanding: total,
          status: 'OPEN',
          lines: [{ description: 'Item de prueba', amount: total }],
          createdBy: user.id,
        }
      });

      const occ = await prisma.scheduledOccurrence.create({
        data: {
          recurringRule: { connect: { id: rule.id } },
          scheduledFor: now,
          status: 'PENDING',
          invoice: { connect: { id: inv.id } }
        }
      });

      invoices.push({ inv, occ });
    }

    console.log('Creado:', invoices.map(x => ({ invoiceId: x.inv.id, dueDate: x.inv.dueDate, occurrenceId: x.occ.id })));
    process.exit(0);
  } catch (err) {
    console.error('Error', err);
    process.exit(1);
  }
}

run();
