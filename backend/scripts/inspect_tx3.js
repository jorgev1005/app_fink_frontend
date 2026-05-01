const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const tx = await prisma.transaction.findUnique({
        where: { id: "bab62c55-5859-4dce-9afd-55a16b58e584" },
        include: { entries: true }
    });
    console.log(JSON.stringify(tx, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
