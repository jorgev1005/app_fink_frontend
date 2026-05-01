
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting currency update...');

  // 1. Update based on keywords in name
  const keywords = ['USD', 'USDT', 'Zelle', 'BofA', 'PayPal', 'Binance', 'Meta Mask', 'Internacional'];
  
  for (const keyword of keywords) {
    const result = await prisma.account.updateMany({
      where: {
        name: { contains: keyword },
        currency: 'BS' // Only update if currently BS
      },
      data: {
        currency: 'USD'
      }
    });
    console.log(`Updated ${result.count} accounts with keyword "${keyword}" to USD.`);
  }

  // 2. Update based on balance heuristic (has USD balance but no BS balance)
  // Note: updateMany doesn't support comparing columns directly easily in all prisma versions/adapters, 
  // so we'll fetch and update.
  const potentialUsdAccounts = await prisma.account.findMany({
    where: {
      currency: 'BS',
      balanceUsd: { not: 0 },
      balanceBs: 0
    }
  });

  console.log(`Found ${potentialUsdAccounts.length} accounts with USD balance only.`);

  for (const acc of potentialUsdAccounts) {
    await prisma.account.update({
      where: { id: acc.id },
      data: { currency: 'USD' }
    });
    console.log(`Updated account ${acc.name} (${acc.code}) to USD based on balance.`);
  }

  console.log('Currency update complete.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
