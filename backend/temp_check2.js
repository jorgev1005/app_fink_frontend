const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const rates = await prisma.exchangeRate.findMany({
        where: { 
            source: 'BCV',
            date: {
                gte: new Date('2026-02-01T00:00:00.000Z'),
                lte: new Date('2026-02-05T23:59:59.999Z')
            }
        },
        orderBy: { date: 'asc' },
        select: { date: true, usdToBs: true }
    });
    console.log("FEBRUARY BCV DATES IN DB:", rates);
}
main().finally(() => prisma.$disconnect());
