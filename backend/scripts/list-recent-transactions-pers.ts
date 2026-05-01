import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  try {
    const projectCode = 'PERS-001';
    const project = await prisma.project.findUnique({ where: { code: projectCode } });
    if (!project) {
      console.error('Proyecto no encontrado:', projectCode);
      process.exit(1);
    }

    const cutoff = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago

    const txs = await prisma.transaction.findMany({
      where: {
        projectId: project.id,
        date: { gte: cutoff },
      },
      include: {
        entries: true,
      },
      orderBy: { date: 'desc' },
    });

    console.log(JSON.stringify({ project: { id: project.id, code: project.code, name: project.name }, cutoff: cutoff.toISOString(), count: txs.length, transactions: txs.map(t => ({
      id: t.id,
      code: t.code,
      date: t.date,
      type: t.type,
      status: t.status,
      currency: t.currency,
      amount: t.amount?.toString(),
      amountBs: t.amountBs?.toString(),
      amountUsd: t.amountUsd?.toString(),
      description: t.description,
      reference: t.reference,
      entries: t.entries.map(e => ({
        id: e.id,
        debitAccountId: e.debitAccountId,
        debitAmount: e.debitAmount?.toString(),
        creditAccountId: e.creditAccountId,
        creditAmount: e.creditAmount?.toString(),
        description: e.description,
      }))
    })) }, null, 2));

  } catch (err) {
    console.error('Error listando transacciones recientes:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
