
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accountCode = "1.1.01.009";
  console.log(`Checking account ${accountCode}...`);

  const acc = await prisma.account.findFirst({
    where: { code: accountCode },
    include: {
      transactionDebits: { include: { transaction: true } },
      transactionCredits: { include: { transaction: true } }
    }
  });

  if (!acc) {
    console.log("Account not found.");
    return;
  }

  console.log("Account details:", {
    id: acc.id,
    name: acc.name,
    balanceUsd: acc.balanceUsd,
    balanceBs: acc.balanceBs,
    isActive: acc.isActive
  });

  console.log("Transactions (Debit):", acc.transactionDebits.map(t => ({ id: t.transaction.id, amount: t.transaction.amount, type: t.transaction.type })));
  console.log("Transactions (Credit):", acc.transactionCredits.map(t => ({ id: t.transaction.id, amount: t.transaction.amount, type: t.transaction.type })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
