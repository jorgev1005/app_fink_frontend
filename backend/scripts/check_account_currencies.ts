
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany({
    where: {
      OR: [
        { subType: 'BANK' },
        { subType: 'WALLET' },
        { subType: 'EXCHANGE' },
        { name: { contains: 'USD' } },
        { name: { contains: 'Binance' } },
        { name: { contains: 'Meta' } }
      ]
    },
    select: {
      id: true,
      name: true,
      code: true,
      currency: true,
      subType: true,
      balanceBs: true,
      balanceUsd: true
    }
  });

  console.log('Accounts found:');
  accounts.forEach(a => {
    console.log(`[${a.code}] ${a.name} | Type: ${a.subType} | Currency: ${a.currency} | BalBs: ${a.balanceBs} | BalUSD: ${a.balanceUsd}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
