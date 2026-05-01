const { PrismaClient } = require('@prisma/client');

const url = "postgresql://grupoal1_finkuser:H3%2Cz%2Cgsjh7VxdVd_@localhost:5432/grupoal1_finkdb";

const prisma = new PrismaClient({
  datasources: { db: { url } }
});

async function main() {
  try {
    console.log("Connecting...");
    const project = await prisma.project.findFirst({
        where: { code: 'PER-04' },
        include: { accounts: true }
    });
    console.log("Connected!");
    if(!project) console.log("Project PER-04 not found");
    else {
        console.log(`Project: ${project.name}`);
        project.accounts.forEach(a => {
            console.log(`[${a.code}] ${a.name}: $${a.balanceUsd} (Active: ${a.isActive})`);
            if (a.balanceUsd === 100 && a.isActive) { // Found the culprit!
                console.log(">>> FOUND ACTIVE ACCOUNT WITH $100. DEACTIVATING...");
                prisma.account.update({
                    where: { id: a.id },
                    data: { isActive: false }
                }).then(() => console.log(">>> DEACTIVATED!"));
            }
        });
    }
  } catch(e) {
      console.error("Error:", e);
  } finally {
      await prisma.$disconnect();
  }
}

main();
