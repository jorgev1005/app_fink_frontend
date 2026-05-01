import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding sample data...');

  // 1. Get the admin user
  const user = await prisma.user.findUnique({
    where: { email: 'admin@admin.com' }
  });

  if (!user) {
    console.error('❌ Admin user not found. Run "npm run prisma:seed" first.');
    return;
  }

  // 2. Create a Project
  const project = await prisma.project.create({
    data: {
      name: 'Proyecto Demo',
      code: 'DEMO',
      description: 'Proyecto de demostración generado automáticamente',
      status: 'ACTIVE',
      users: {
        create: {
          userId: user.id,
          role: 'OWNER'
        }
      }
    }
  });
  console.log('✅ Project created:', project.name);

  // 3. Create Accounts
  const bankAccount = await prisma.account.create({
    data: {
      projectId: project.id,
      name: 'Banco Nacional',
      code: '1.1.1.01',
      type: 'ASSET',
      subType: 'BANK',
      balanceBs: 10000,
      balanceUsd: 250,
      balanceEur: 0,
      description: 'Cuenta principal en Bolívares'
    }
  });

  const cashAccount = await prisma.account.create({
    data: {
      projectId: project.id,
      name: 'Caja Chica USD',
      code: '1.1.1.02',
      type: 'ASSET',
      subType: 'CASH',
      balanceBs: 0,
      balanceUsd: 500,
      balanceEur: 0,
      description: 'Efectivo en dólares'
    }
  });

  const expenseAccount = await prisma.account.create({
    data: {
      projectId: project.id,
      name: 'Gastos de Oficina',
      code: '5.1.1.01',
      type: 'EXPENSE',
      subType: 'ADMINISTRATIVE',
      balanceBs: 0,
      balanceUsd: 0,
      balanceEur: 0
    }
  });

  const incomeAccount = await prisma.account.create({
    data: {
      projectId: project.id,
      name: 'Ventas Servicios',
      code: '4.1.1.01',
      type: 'REVENUE',
      subType: 'SERVICES',
      balanceBs: 0,
      balanceUsd: 0,
      balanceEur: 0
    }
  });
  console.log('✅ Accounts created');

  // 4. Create Categories
  const catServices = await prisma.transactionCategory.create({
    data: {
      name: 'Servicios Profesionales',
      projectId: project.id
    }
  });

  const catOffice = await prisma.transactionCategory.create({
    data: {
      name: 'Material de Oficina',
      projectId: project.id
    }
  });
  console.log('✅ Categories created');

  // 5. Create Transactions
  // Income Transaction
  await prisma.transaction.create({
    data: {
      projectId: project.id,
      userId: user.id,
      code: 'TRX-DEMO-0001',
      type: 'INCOME',
      date: new Date(),
      description: 'Venta de consultoría inicial',
      amount: 200,
      currency: 'USD',
      amountUsd: 200,
      amountBs: 8000, // Assuming 40 rate roughly
      amountEur: 0,
      status: 'COMPLETED',
      categoryId: catServices.id,
      tags: '[]',
      attachments: '[]',
      entries: {
        create: [
          {
            debitAccountId: cashAccount.id,
            debitAmount: 200,
            description: 'Ingreso a Caja'
          },
          {
            creditAccountId: incomeAccount.id,
            creditAmount: 200,
            description: 'Registro de Venta'
          }
        ]
      }
    }
  });

  // Expense Transaction
  await prisma.transaction.create({
    data: {
      projectId: project.id,
      userId: user.id,
      code: 'TRX-DEMO-0002',
      type: 'EXPENSE',
      date: new Date(),
      description: 'Compra de papel y toner',
      amount: 1500,
      currency: 'BS',
      amountUsd: 37.5,
      amountBs: 1500,
      amountEur: 0,
      status: 'COMPLETED',
      categoryId: catOffice.id,
      tags: '[]',
      attachments: '[]',
      entries: {
        create: [
          {
            debitAccountId: expenseAccount.id,
            debitAmount: 1500,
            description: 'Gasto registrado'
          },
          {
            creditAccountId: bankAccount.id,
            creditAmount: 1500,
            description: 'Salida de Banco'
          }
        ]
      }
    }
  });
  console.log('✅ Transactions created');

  console.log('🚀 Sample data seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
