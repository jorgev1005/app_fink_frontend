
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Update the specific payment transaction to be of type 'PAYMENT'
  // ID from previous debug output: 9f87fb38-06e8-4838-a3e0-650041d528be
  const updated = await prisma.transaction.update({
    where: { id: '9f87fb38-06e8-4838-a3e0-650041d528be' },
    data: { type: 'PAYMENT' }
  });
  console.log('Updated transaction:', updated);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
