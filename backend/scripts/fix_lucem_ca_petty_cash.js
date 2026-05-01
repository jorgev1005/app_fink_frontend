const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const TARGET_PROJECT_CODES = ['LUCE-002'];
const TARGET_PROJECT_NAMES = ['Inversiones Lucem C.A.'];
const TARGET_ACCOUNT_CODE = '1.1.01.005';
const TARGET_ACCOUNT_NAME = 'Caja Chica USD';
const TARGET_USD_BALANCE = 300;
const BACKUP_DIR = path.join(__dirname, '..', 'reports', 'account-fixes');

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

async function getLedgerBalances(accountId) {
  const [debitsBs, creditsBs, debitsUsd, creditsUsd, debitsEur, creditsEur] = await Promise.all([
    prisma.transactionEntry.aggregate({ where: { debitAccountId: accountId, transaction: { currency: 'BS' } }, _sum: { debitAmount: true } }),
    prisma.transactionEntry.aggregate({ where: { creditAccountId: accountId, transaction: { currency: 'BS' } }, _sum: { creditAmount: true } }),
    prisma.transactionEntry.aggregate({ where: { debitAccountId: accountId, transaction: { currency: 'USD' } }, _sum: { debitAmount: true } }),
    prisma.transactionEntry.aggregate({ where: { creditAccountId: accountId, transaction: { currency: 'USD' } }, _sum: { creditAmount: true } }),
    prisma.transactionEntry.aggregate({ where: { debitAccountId: accountId, transaction: { currency: 'EUR' } }, _sum: { debitAmount: true } }),
    prisma.transactionEntry.aggregate({ where: { creditAccountId: accountId, transaction: { currency: 'EUR' } }, _sum: { creditAmount: true } }),
  ]);

  return {
    balanceBs: round2(Number(debitsBs._sum.debitAmount || 0) - Number(creditsBs._sum.creditAmount || 0)),
    balanceUsd: round2(Number(debitsUsd._sum.debitAmount || 0) - Number(creditsUsd._sum.creditAmount || 0)),
    balanceEur: round2(Number(debitsEur._sum.debitAmount || 0) - Number(creditsEur._sum.creditAmount || 0)),
  };
}

async function findTargetProject() {
  return prisma.project.findFirst({
    where: {
      OR: [
        { code: { in: TARGET_PROJECT_CODES } },
        ...TARGET_PROJECT_NAMES.map((name) => ({ name })),
      ],
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
  });
}

async function findProjectAccounts(projectId) {
  return prisma.account.findMany({
    where: { projectId },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      currency: true,
      balanceBs: true,
      balanceUsd: true,
      balanceEur: true,
      isActive: true,
      updatedAt: true,
    },
    orderBy: [{ code: 'asc' }],
  });
}

function printAccount(label, account) {
  console.log(`\n${label}`);
  console.log(JSON.stringify(account, null, 2));
}

function createBackupFile(project, account, similarAccounts, ledgerBalances) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(BACKUP_DIR, `lucem-ca-petty-cash-${project.code}-${stamp}.json`);
  const payload = {
    createdAt: new Date().toISOString(),
    project,
    target: {
      accountCode: TARGET_ACCOUNT_CODE,
      desiredName: TARGET_ACCOUNT_NAME,
      desiredCurrency: 'USD',
      desiredBalanceBs: 0,
      desiredBalanceUsd: TARGET_USD_BALANCE,
      desiredBalanceEur: 0,
      desiredIsActive: true,
    },
    before: {
      account,
      ledgerBalances,
      similarAccounts,
    },
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));

  return filePath;
}

function updateBackupFile(filePath, updatedAccount) {
  const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  current.after = {
    account: updatedAccount,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(current, null, 2));
}

async function main() {
  const project = await findTargetProject();

  if (!project) {
    console.error('No se encontro el proyecto objetivo (LUCE-002 / Inversiones Lucem C.A.).');
    process.exitCode = 1;
    return;
  }

  console.log(`Proyecto localizado: ${project.code} - ${project.name}`);

  const accounts = await findProjectAccounts(project.id);
  const exactAccount = accounts.find((account) => account.code === TARGET_ACCOUNT_CODE);
  const similarAccounts = accounts.filter((account) =>
    account.name.toLowerCase().includes('caja chica usd') || account.code.startsWith('1.1.01.')
  );

  if (!exactAccount) {
    console.error(`No se encontro la cuenta ${TARGET_ACCOUNT_CODE} en ${project.name}.`);
    console.log('Cuentas relacionadas encontradas:');
    console.log(JSON.stringify(similarAccounts, null, 2));
    process.exitCode = 1;
    return;
  }

  printAccount('Cuenta actual encontrada:', exactAccount);

  const ledgerBalances = await getLedgerBalances(exactAccount.id);
  printAccount('Balance reconstruido desde libro contable:', ledgerBalances);

  if (!APPLY) {
    console.log('\nModo inspeccion. No se aplicaron cambios.');
    console.log('Ejecuta con --apply para corregir metadata y registrar un ADJUSTMENT que deje la cuenta en USD 300.');
    return;
  }

  const backupPath = createBackupFile(project, exactAccount, similarAccounts, ledgerBalances);
  console.log(`\nRespaldo guardado en: ${backupPath}`);

    const hasBs = Math.abs(ledgerBalances.balanceBs) > 0.01;
    const hasEur = Math.abs(ledgerBalances.balanceEur) > 0.01;
    
    if (hasEur) {
      throw new Error(`La cuenta tiene movimientos en EUR (${ledgerBalances.balanceEur}). Revisión manual requerida.`);
    }

    const usdDelta = round2(TARGET_USD_BALANCE - ledgerBalances.balanceUsd);
    const bsDelta = hasBs ? round2(0 - ledgerBalances.balanceBs) : 0;
    const equityAccount = await prisma.account.findFirst({
      where: {
        projectId: exactAccount.projectId,
        type: 'EQUITY',
        isActive: true,
      },
    select: {
      id: true,
      code: true,
      name: true,
      balanceBs: true,
      balanceUsd: true,
      balanceEur: true,
    },
  });

  if (!equityAccount) {
    throw new Error('No se encontró cuenta de patrimonio/contrapartida activa en el proyecto.');
  }

  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) {
    throw new Error('No se encontró ningún usuario para registrar el ajuste.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const syncedAccount = await tx.account.update({
      where: { id: exactAccount.id },
      data: {
        name: TARGET_ACCOUNT_NAME,
        description: 'Efectivo USD',
        currency: 'USD',
        balanceBs: ledgerBalances.balanceBs,
        balanceUsd: ledgerBalances.balanceUsd,
        balanceEur: ledgerBalances.balanceEur,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        currency: true,
        balanceBs: true,
        balanceUsd: true,
        balanceEur: true,
        isActive: true,
        updatedAt: true,
      },
    });

    if (Math.abs(usdDelta) <= 0.01) {
      return syncedAccount;
    }

    const adjustmentAmount = Math.abs(usdDelta);
    const debitAccountId = usdDelta > 0 ? syncedAccount.id : equityAccount.id;
    const creditAccountId = usdDelta > 0 ? equityAccount.id : syncedAccount.id;
    const uniqueSuffix = Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const trxCode = `TRX-FIX-${syncedAccount.code}-${uniqueSuffix}`;

    await tx.transaction.create({
      data: {
        code: trxCode,
        type: 'ADJUSTMENT',
        description: `Corrección contable segura para ${syncedAccount.name}`,
        date: new Date(),
        currency: 'USD',
        amount: adjustmentAmount,
        amountBs: 0,
        amountUsd: adjustmentAmount,
        amountEur: 0,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        amountPaid: adjustmentAmount,
        tags: '["correccion","lucem"]',
        attachments: '[]',
        project: { connect: { id: project.id } },
        user: { connect: { id: user.id } },
        entries: {
          create: [
            {
              debitAccount: { connect: { id: debitAccountId } },
              creditAccount: { connect: { id: creditAccountId } },
              debitAmount: adjustmentAmount,
              creditAmount: adjustmentAmount,
              description: 'Corrección segura de saldo Caja Chica USD',
            },
          ],
        },
      },
    });

    await tx.account.update({
      where: { id: debitAccountId },
      data: { balanceUsd: { increment: adjustmentAmount } },
    });

    await tx.account.update({
      where: { id: creditAccountId },
      data: { balanceUsd: { increment: -adjustmentAmount } },
    });

    return tx.account.findUnique({
      where: { id: syncedAccount.id },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        currency: true,
        balanceBs: true,
        balanceUsd: true,
        balanceEur: true,
        isActive: true,
        updatedAt: true,
      },
    });
  });

  updateBackupFile(backupPath, updated);

  printAccount('Cuenta actualizada:', updated);

  const otherCajaUsdAccounts = accounts.filter((account) =>
    account.id !== exactAccount.id && account.name.toLowerCase().includes('caja chica usd')
  );

  if (otherCajaUsdAccounts.length > 0) {
    console.log('\nOtras cuentas similares en el proyecto:');
    console.log(JSON.stringify(otherCajaUsdAccounts, null, 2));
  }
}

main()
  .catch((error) => {
    console.error('Error corrigiendo la cuenta de Lucem C.A.:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });