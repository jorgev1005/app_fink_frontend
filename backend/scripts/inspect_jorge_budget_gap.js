const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const codes = [
    'TRX-JLV-013-873804338',
    'TRX-JLV-013-043207926',
    'TRX-JLV-013-312924960',
    'TRX-JLV-013-208368756',
    'TRX-JLV-013-262192514',
    'TRX-JLV-013-128345097',
    'TRX-JLV-013-113385188',
    'TRX-JLV-013-250933221',
    'TRX-JLV-013-315098003'
  ];
  const txs = await prisma.transaction.findMany({
    where: { code: { in: codes } },
    include: {
      allocations: { include: { payment: true } },
      contactPerson: true,
      project: true
    },
    orderBy: { date: 'asc' }
  });

  for (const tx of txs) {
    console.log('---');
    console.log(tx.code, '|', tx.description);
    console.log('status=', tx.status, 'paymentStatus=', tx.paymentStatus, 'amount=', tx.amount, 'amountPaid=', tx.amountPaid, 'type=', tx.type);
    console.log('contact=', tx.contactPerson?.name, 'project=', tx.project?.name);
    console.log('allocations=', tx.allocations.length);
    for (const alloc of tx.allocations) {
      console.log('  alloc', alloc.allocatedAmount, alloc.payment?.currency, alloc.payment?.status, alloc.payment?.reference || null);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
