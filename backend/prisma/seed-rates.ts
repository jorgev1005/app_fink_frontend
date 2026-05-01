import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding exchange rates...');

  await prisma.exchangeRate.create({
    data: {
      date: new Date(),
      source: 'BCV',
      usdToBs: 45.50,
      eurToBs: 48.20,
      eurToUsd: 1.06,
      isOfficial: true
    }
  });

  console.log('✅ Exchange rates seeded');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
