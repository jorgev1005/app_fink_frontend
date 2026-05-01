const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("---- Transacciones asociadas a los saldos ----");
    
    // Lucem
    const lucemAcc = await prisma.account.findUnique({ where: { id: "f3c19959-c2a6-42a1-9d54-69eb8e33ca2a" } });
    if (lucemAcc) {
        console.log("--- Inversiones Lucem Entradas ---");
        const entries = await prisma.transactionEntry.findMany({
            where: { OR: [ { debitAccountId: lucemAcc.id }, { creditAccountId: lucemAcc.id } ] },
            include: { transaction: true }
        });
        entries.forEach(e => {
            console.log(`ID: ${e.id} | TX ID: ${e.transaction.id} | Debit: ${e.debitAmount} | Credit: ${e.creditAmount} | ref: ${e.transaction.reference}`);
        });
    }

    // Jorge
    const jorgeAcc = await prisma.account.findUnique({ where: { id: "0d82ce31-21fd-4d03-8851-f5ccb1b15c31" } });
    if (jorgeAcc) {
        console.log("--- Jorge Verenzuela Entradas ---");
        const entries = await prisma.transactionEntry.findMany({
            where: { OR: [ { debitAccountId: jorgeAcc.id }, { creditAccountId: jorgeAcc.id } ] },
            include: { transaction: true }
        });
        entries.forEach(e => {
            console.log(`ID: ${e.id} | TX ID: ${e.transaction.id} | Debit: ${e.debitAmount} | Credit: ${e.creditAmount} | ref: ${e.transaction.reference}`);
        });
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
