const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.log('--- CUENTAS DE LIQUIDEZ ---');
    const p = await prisma.account.findMany({ 
        where: { type: 'ASSET', subType: { in: ['BANK', 'CASH', 'WALLET'] } }, 
        select: { name: true, subType: true, balanceBs: true, balanceUsd: true, balanceEur: true } 
    });
    console.log(p);

    console.log('\n--- DEUDAS (INVOICES BILL OPEN) ---');
    const inv = await prisma.invoice.findMany({
        where: { type: 'BILL', status: 'OPEN' },
        select: { code: true, currency: true, outstanding: true }
    });
    console.log(inv);
}
main().catch(console.error).finally(() => prisma.$disconnect());
