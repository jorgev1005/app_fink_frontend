
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projectId = '350cc719-d635-400c-b75d-e7b728bbd8bd'; // Inversiones Lucem C.A.

  console.log('Setting up Asset accounts for Inversiones Lucem C.A...');

  // 1. Ensure Parent Exists (1.4.01)
  let parentAsset = await prisma.account.findFirst({
    where: { projectId, code: '1.4.01' }
  });

  if (!parentAsset) {
    parentAsset = await prisma.account.create({
      data: {
        projectId,
        code: '1.4.01',
        name: 'Mobiliario y Equipos',
        type: 'ASSET',
        subType: 'FIXED_ASSET',
        currency: 'USD'
      }
    });
    console.log('Created parent asset account 1.4.01');
  }

  // 2. Create Sub-Accounts for Assets
  const assets = [
    { code: '1.4.01.001', name: 'Equipos de Computación', type: 'ASSET', subType: 'FIXED_ASSET' },
    { code: '1.4.01.002', name: 'Vehículos', type: 'ASSET', subType: 'FIXED_ASSET' },
    { code: '1.4.01.003', name: 'Maquinaria y Equipos', type: 'ASSET', subType: 'FIXED_ASSET' },
    { code: '1.4.01.004', name: 'Mobiliario de Oficina', type: 'ASSET', subType: 'FIXED_ASSET' }
  ];

  for (const a of assets) {
    const exists = await prisma.account.findFirst({ where: { projectId, code: a.code } });
    if (!exists) {
      await prisma.account.create({
        data: {
          projectId,
          code: a.code,
          name: a.name,
          type: a.type,
          subType: a.subType,
          currency: 'USD',
          parentId: parentAsset.id
        }
      });
      console.log(`Created asset account ${a.code} - ${a.name}`);
    }
  }

  // 3. Create Revenue Account for Gain
  const gainCode = '4.2.01.001';
  const gainExists = await prisma.account.findFirst({ where: { projectId, code: gainCode } });
  if (!gainExists) {
    // Find parent 4.2.01
    const parentRev = await prisma.account.findFirst({ where: { projectId, code: '4.2.01' } });
    await prisma.account.create({
      data: {
        projectId,
        code: gainCode,
        name: 'Ganancia en Venta de Activos',
        type: 'REVENUE',
        subType: 'OTHER_INCOME',
        currency: 'USD',
        parentId: parentRev?.id
      }
    });
    console.log(`Created revenue account ${gainCode}`);
  }

  // 4. Create Expense Account for Loss
  const lossCode = '5.4.01';
  const lossExists = await prisma.account.findFirst({ where: { projectId, code: lossCode } });
  if (!lossExists) {
    await prisma.account.create({
      data: {
        projectId,
        code: lossCode,
        name: 'Pérdida en Venta de Activos',
        type: 'EXPENSE',
        subType: 'OTHER_EXPENSE',
        currency: 'USD'
      }
    });
    console.log(`Created expense account ${lossCode}`);
  }

  console.log('Done.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
