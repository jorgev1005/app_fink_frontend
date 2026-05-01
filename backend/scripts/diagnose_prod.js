const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const project = await prisma.project.findFirst({
        where: { code: 'PER-04' },
        include: { accounts: true } 
    });

    if (!project) {
        console.log("❌ Project PER-04 not found.");
        return;
    }

    console.log(`\n🔍 Diagnosis for Project: ${project.name} (${project.code})`);
    console.log("---------------------------------------------------");
    console.table(project.accounts.map(a => ({
        Code: a.code,
        Name: a.name,
        BalanceUSD: a.balanceUsd,
        IsActive: a.isActive
    })));
  } catch(e) {
      console.error(e);
  } finally {
      await prisma.$disconnect();
  }
}

main();
