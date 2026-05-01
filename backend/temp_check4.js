const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const rates = await prisma.exchangeRate.findMany({
        where: { source: 'BCV' },
        orderBy: { date: 'asc' },
        select: { date: true, usdToBs: true }
    });
    console.log(rates.map(r => r.date.toISOString().split('T')[0]));
}
main().finally(() => prisma.$disconnect());
