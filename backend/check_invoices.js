const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- INVOICES IN DATABASE ---');
    const invoices = await prisma.invoice.findMany({
        where: { code: { in: ['0202', '0201'] } },
        select: { code: true, total: true, outstanding: true, status: true, totalCost: true, netProfit: true, lines: true }
    });
    console.log(JSON.stringify(invoices, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
