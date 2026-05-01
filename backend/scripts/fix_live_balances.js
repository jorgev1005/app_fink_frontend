const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("---- Aplicando Correcciones en la Base de Datos (PRODUCCION) ----");

    const jorgeAccId = "0d82ce31-21fd-4d03-8851-f5ccb1b15c31";
    const lucemAccId = "f3c19959-c2a6-42a1-9d54-69eb8e33ca2a";

    // 1. Arreglar cuenta de Jorge Verenzuela
    const jorgeAcc = await prisma.account.findUnique({ where: { id: jorgeAccId } });
    if (jorgeAcc && jorgeAcc.currency === 'BS') {
        console.log("Corrigiendo cuenta de Jorge Verenzuela...");
        await prisma.account.update({
            where: { id: jorgeAccId },
            data: {
                currency: 'USD',
                balanceBs: 0,
                balanceUsd: 100 // Sabemos que el saldo debia ser los 100 de la transferencia
            }
        });
        console.log("-> Moneda cambiada a USD, y balanceUsd establecido en 100. balanceBs en 0.");
    } else {
        console.log("La cuenta de Jorge ya esta en USD o no se encontro.");
    }

    // 2. Arreglar cuenta de Inversiones Lucem C.A.
    const lucemAcc = await prisma.account.findUnique({ where: { id: lucemAccId } });
    if (lucemAcc && Number(lucemAcc.balanceBs) < 0) {
        console.log("Corrigiendo cuenta de Inversiones Lucem...");
        await prisma.account.update({
            where: { id: lucemAccId },
            data: {
                balanceBs: 0
            }
        });
        console.log("-> balanceBs reseteado a 0.");
    } else {
        console.log("La cuenta de Lucem no tiene saldo negativo en Bs o no se encontro.");
    }

    console.log("---- Fin de las correcciones ----");
}
main().catch(console.error).finally(() => prisma.$disconnect());
