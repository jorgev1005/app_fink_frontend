const { PrismaClient } = require('@prisma/client');

const credentials = [
    "postgresql://fink:ufink035@localhost:5432/fink_db",
    "postgresql://postgres:ufink035@localhost:5432/fink_db",
    "postgresql://grupoal1_finkuser:H3,z,gsjh7VxdVd_@localhost:5432/grupoal1_finkdb",
    "postgresql://fink:ufink035@localhost:5432/grupoal1_finkdb",
    "postgresql://postgres:ufink035@localhost:5432/grupoal1_finkdb",
    "postgresql://grupoal1_finkuser:H3,z,gsjh7VxdVd_@localhost:5432/fink_db"
];

async function tryConnect(url) {
    console.log(`Trying: ${url.replace(/:[^:]*@/, ':****@')}`);
    const prisma = new PrismaClient({
        datasources: { db: { url } }
    });
    try {
        const project = await prisma.project.findFirst({
            where: { code: 'PER-04' },
            include: { accounts: true }
        });
        console.log("✅ SUCCESS!");
        if (project) {
            console.log(`Project: ${project.name}`);
            console.table(project.accounts.map(a => ({ Code: a.code, Bal: a.balanceUsd, Active: a.isActive })));
        } else {
            console.log("Project PER-04 not found (DB connected though)");
        }
        return true;
    } catch (e) {
        console.log("❌ Failed: " + (e.message ? e.message.split('\n')[0] : e));
        return false;
    } finally {
        await prisma.$disconnect();
    }
}

async function main() {
    for (const url of credentials) {
        if (await tryConnect(url)) break;
    }
}

main();
