const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("---- Cuentas en el VPS de Produccion ----");
    const accs = await prisma.account.findMany({ 
        where: { name: { contains: 'Caja Chica USD', mode: 'insensitive' } }, 
        include:{ project: true } 
    });
    for(let a of accs) {
        console.log(`ID: ${a.id}`);
        console.log(`Proyecto: ${a.project?.name}`);
        console.log(`Moneda actual: ${a.currency}`);
        console.log(`Balance BS: ${a.balanceBs}`);
        console.log(`Balance USD: ${a.balanceUsd}`);
        console.log('-----------------------------------');
    }
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
