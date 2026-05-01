const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const rates = await prisma.exchangeRate.findMany({
        where: { source: 'BCV' },
        orderBy: { date: 'asc' },
        take: 3
    });
    console.log("OLD BCV DATES:", rates.map(r => r.date));
}
main().finally(() => prisma.$disconnect());
