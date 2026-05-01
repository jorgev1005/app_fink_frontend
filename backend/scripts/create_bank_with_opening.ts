import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateCodeAtomic(type: string, subType: string | undefined, projectId?: string) {
  const typeMajorMap: Record<string, number> = {
    ASSET: 1,
    LIABILITY: 2,
    EQUITY: 3,
    REVENUE: 4,
    EXPENSE: 5,
  };
  const pId = projectId || undefined;
  const where: any = { type: type as any, projectId: pId };
  if (subType) where.subType = subType as any;
  const updateRes = await prisma.accountCodeSequence.updateMany({ where, data: { counter: { increment: 1 } } });
  let seqRow: any = null;
  if (updateRes.count === 0) {
    seqRow = await prisma.accountCodeSequence.create({ data: { projectId: pId, type: type as any, subType: subType as any || undefined, counter: 1 } });
  } else {
    seqRow = await prisma.accountCodeSequence.findFirst({ where, orderBy: { updatedAt: 'desc' } });
  }
  if (!seqRow) throw new Error('No sequence row');
  const major = typeMajorMap[type] || 9;
  const cnt = seqRow.counter || 0;
  const padded = String(cnt).padStart(3, '0');
  return `${major}.${padded}`;
}

async function main(){
  // Config
  const projectId = '060574e5-7612-4870-972e-8b9b14c53e2e';
  const bankName = 'Banco Prueba (script)';
  const initialAmount = 50000; // 50.000
  const initialCurrency: any = 'BS';
  const systemUserId = '8de01782-ce46-496f-a0d6-bbd9de90fb7e'; // existing user in DB

  // 1) create or reuse equity account in project
  let equity = await prisma.account.findFirst({ where: { type: 'EQUITY', name: 'Opening Balances (Equity)', projectId } });
  if (!equity) {
    const eqCode = await generateCodeAtomic('EQUITY', 'CAPITAL', projectId);
    equity = await prisma.account.create({ data: { code: eqCode, name: 'Opening Balances (Equity)', description: 'Cuenta para saldos iniciales (script)', type: 'EQUITY', subType: 'CAPITAL', balanceBs: 0, balanceUsd: 0, balanceEur: 0, isActive: true, project: { connect: { id: projectId } } } });
    console.log('Created equity account:', equity.id);
  } else {
    console.log('Reusing equity account:', equity.id);
  }

  // 2) generate code for bank account
  const bankCode = await generateCodeAtomic('ASSET', 'BANK', projectId);

  // 3) create bank account + opening transaction atomically
  const result = await prisma.$transaction(async (tx) => {
    const acc = await tx.account.create({ data: { code: bankCode, name: bankName, description: 'Cuenta creada por script con saldo inicial', type: 'ASSET', subType: 'BANK', balanceBs: 0, balanceUsd: 0, balanceEur: 0, isActive: true, project: { connect: { id: projectId } } }, include: { project: true } });

    const projectRow = await tx.project.findUnique({ where: { id: projectId }, select: { code: true } });
    if (!projectRow) throw new Error('Project not found');

    const trxCount = await tx.transaction.count({ where: { projectId } });
    const trxCode = `TRX-${projectRow.code}-${String(trxCount + 1).padStart(4,'0')}`;

    const isAsset = true;
    const debitAccountId = isAsset ? acc.id : equity.id;
    const creditAccountId = isAsset ? equity.id : acc.id;

  const amountBs = initialCurrency === 'BS' ? initialAmount : 0;
  const amountUsd = initialCurrency === 'USD' ? initialAmount : 0;
  const amountEur = initialCurrency === 'EUR' ? initialAmount : 0;

  const txn = await tx.transaction.create({ data: { code: trxCode, type: 'ADJUSTMENT', description: `Saldo inicial para ${acc.code}`, date: new Date(), currency: initialCurrency as any, amount: initialAmount, amountBs, amountUsd, amountEur, status: 'COMPLETED', project: { connect: { id: projectId } }, user: { connect: { id: systemUserId } }, entries: { create: [ { debitAccount: { connect: { id: debitAccountId } }, creditAccount: { connect: { id: creditAccountId } }, debitAmount: isAsset ? initialAmount : 0, creditAmount: isAsset ? 0 : initialAmount, description: 'Apertura / saldo inicial (script)' } ] } }, include: { entries: true } });

    // update balances
    if (initialCurrency === 'BS') {
      await tx.account.update({ where: { id: debitAccountId }, data: { balanceBs: { increment: initialAmount } } });
      await tx.account.update({ where: { id: creditAccountId }, data: { balanceBs: { increment: -initialAmount } } });
    } else if (initialCurrency === 'USD') {
      await tx.account.update({ where: { id: debitAccountId }, data: { balanceUsd: { increment: initialAmount } } });
      await tx.account.update({ where: { id: creditAccountId }, data: { balanceUsd: { increment: -initialAmount } } });
    } else {
      await tx.account.update({ where: { id: debitAccountId }, data: { balanceEur: { increment: initialAmount } } });
      await tx.account.update({ where: { id: creditAccountId }, data: { balanceEur: { increment: -initialAmount } } });
    }

    return { account: acc, transaction: txn };
  });

  console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());
