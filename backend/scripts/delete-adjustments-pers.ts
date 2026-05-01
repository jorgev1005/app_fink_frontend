import prisma from '../src/config/database';

async function main() {
  const projectCode = 'PERS-001'; // Proyecto personal (fallbacks below)
  let project = await prisma.project.findUnique({ where: { code: projectCode } });

  if (!project) {
    // Fallback: try by name "PERSONAL" (case-insensitive)
    project = await prisma.project.findFirst({ where: { name: { contains: 'PERSONAL', mode: 'insensitive' } } });
  }

  if (!project) {
    console.error('Proyecto personal no encontrado (tried code PERS-001 and name PERSONAL).');
    process.exit(1);
  }

  console.log('Proyecto encontrado:', { id: project.id, code: project.code, name: project.name });

  const txs = await prisma.transaction.findMany({
    where: {
      projectId: project.id,
      type: 'ADJUSTMENT',
    },
    include: { entries: true },
    orderBy: { date: 'desc' },
  });

  console.log(`Encontradas ${txs.length} transacciones de tipo ADJUSTMENT en el proyecto ${project.code}`);

  if (txs.length === 0) {
    await prisma.$disconnect();
    process.exit(0);
  }

  // Print a compact summary
  for (const t of txs) {
    console.log(`- id=${t.id} code=${t.code} date=${t.date.toISOString()} amount=${t.amount?.toString()} currency=${t.currency} entries=${t.entries.length}`);
  }

  // Require explicit --apply flag to proceed with deletion
  const shouldApply = process.argv.includes('--apply') || process.argv.includes('-y');
  if (!shouldApply) {
    console.log('\nNo se aplicó ninguna eliminación. Si quieres borrar estas transacciones, vuelve a ejecutar este script con el flag --apply (o -y)');
    await prisma.$disconnect();
    process.exit(0);
  }

  // Perform deletion
  console.log('\nEliminando transacciones...');
  const res = await prisma.transaction.deleteMany({
    where: {
      projectId: project.id,
      type: 'ADJUSTMENT',
    }
  });

  console.log(`Transacciones eliminadas: ${res.count}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error ejecutando script:', err);
  process.exit(1);
});
