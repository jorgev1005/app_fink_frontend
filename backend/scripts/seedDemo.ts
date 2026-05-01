import prisma from '../src/config/database';

async function main() {
  console.log('Creating demo project and accounts...');

  const project = await prisma.project.create({
    data: {
      name: 'Demo Project',
      code: 'DEMO',
      description: 'Proyecto de demostración generado por seedDemo',
      initialCapitalUsd: 0,
    },
  });

  // Crear algunas cuentas con saldos iniciales
  const parent = await prisma.account.create({
    data: {
      code: '1',
      name: 'ACTIVOS',
      type: 'ASSET',
      subType: 'CASH',
      projectId: project.id,
      balanceUsd: 1000,
      balanceBs: 0,
      isActive: true,
    },
  });

  const cash = await prisma.account.create({
    data: {
      code: '1.1',
      name: 'Caja',
      type: 'ASSET',
      subType: 'CASH',
      projectId: project.id,
      parentId: parent.id,
      balanceUsd: 500,
      balanceBs: 0,
      isActive: true,
    },
  });

  const bank = await prisma.account.create({
    data: {
      code: '1.2',
      name: 'Banco',
      type: 'ASSET',
      subType: 'BANK',
      projectId: project.id,
      parentId: parent.id,
      balanceUsd: 500,
      balanceBs: 0,
      isActive: true,
    },
  });

  console.log('Seed complete. Project:', project.id);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
