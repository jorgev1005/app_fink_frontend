process.env.DATABASE_URL = "postgresql://grupoal1_finkuser:H3,z,gsjh7VxdVd_@localhost:5432/grupoal1_finkdb";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lucemProject = await prisma.project.findFirst({
    where: { name: { contains: 'Lucem', mode: 'insensitive' } }
  });

  if (!lucemProject) {
    console.error('Proyecto Lucem no encontrado');
    return;
  }

  console.log(`Lucem Project ID: ${lucemProject.id}`);

  // 1. Rename old conflicting invoices by adding 'FAC-' prefix
  const oldConflicts = [
    { code: '0197', createdAt: '2026-07-06T20:36:30.292Z' },
    { code: '0198', createdAt: '2026-07-27T13:03:18.502Z' },
    { code: '0201', createdAt: '2026-06-10T19:17:20.185Z' },
    { code: '0202', createdAt: '2026-06-11T19:24:14.411Z' },
    { code: '0203', createdAt: '2026-06-12T21:56:28.014Z' }
  ];

  for (const c of oldConflicts) {
    const inv = await prisma.invoice.findFirst({
      where: { code: c.code, projectId: lucemProject.id }
    });
    if (inv) {
      const newCode = `FAC-${c.code}`;
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { code: newCode }
      });
      console.log(`[RENAMED PREVIOUS] ${c.code} -> ${newCode} (ID: ${inv.id})`);
    }
  }

  // 2. Renumber today's invoices
  // 0199 ($1505.68) -> 0197
  const inv199 = await prisma.invoice.findFirst({ where: { code: '0199', projectId: lucemProject.id } });
  if (inv199) {
    await prisma.invoice.update({ where: { id: inv199.id }, data: { code: '0197' } });
    console.log(`[RENUMBERED TODAY] 0199 ($1505.68) -> 0197`);
  }

  // 0200 ($382.80) -> 0198
  const inv200 = await prisma.invoice.findFirst({ where: { code: '0200', projectId: lucemProject.id } });
  if (inv200) {
    await prisma.invoice.update({ where: { id: inv200.id }, data: { code: '0198' } });
    console.log(`[RENUMBERED TODAY] 0200 ($382.80) -> 0198`);
  }

  // 0204 ($63.80) -> 0199
  const inv204 = await prisma.invoice.findFirst({ where: { code: '0204', projectId: lucemProject.id } });
  if (inv204) {
    await prisma.invoice.update({ where: { id: inv204.id }, data: { code: '0199' } });
    console.log(`[RENUMBERED TODAY] 0204 ($63.80) -> 0199`);
  }

  // 3. Update project's lastInvoiceNumber to '0199'
  await prisma.project.update({
    where: { id: lucemProject.id },
    data: { lastInvoiceNumber: '0199' }
  });
  console.log(`[UPDATED PROJECT] lastInvoiceNumber set to '0199' for ${lucemProject.name}`);

  // 4. Verify final list
  const finalInvoices = await prisma.invoice.findMany({
    where: { projectId: lucemProject.id },
    select: { code: true, type: true, total: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });

  console.log('\n=== ESTADO FINAL DE FACTURAS EN LUCEM ===');
  console.table(finalInvoices.map(i => ({
    code: i.code,
    type: i.type,
    total: i.total,
    createdAt: i.createdAt.toISOString()
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
