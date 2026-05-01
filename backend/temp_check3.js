const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const rates = await prisma.exchangeRate.findMany({
        where: { 
            source: 'BCV'
        },
        orderBy: { date: 'asc' },
        select: { date: true, usdToBs: true }
    });
    console.log("TOTAL BCV RATES:", rates.length);
    console.log("FIRST:", rates[0]?.date);
    console.log("LAST:", rates[rates.length - 1]?.date);
}
main().finally(() => prisma.$disconnect());
