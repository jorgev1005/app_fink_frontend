import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function repro() {
    console.log("Creating test project...");
    const project = await prisma.project.create({
        data: {
            name: "Test Project Dashboard",
            code: "TEST-DBH",
            description: "Test for dashboard balances",
            status: "ACTIVE"
        }
    });

    console.log("Creating Active USD Account with Balance...");
    const activeAccount = await prisma.account.create({
        data: {
            code: "1.1.001",
            name: "Active Account",
            type: "ASSET",
            subType: "BANK",
            currency: "USD",
            balanceUsd: 100,
            projectId: project.id
        }
    });

    console.log("Creating Inactive USD Account with Balance...");
    const inactiveAccount = await prisma.account.create({
        data: {
            code: "1.1.002",
            name: "Inactive Account",
            type: "ASSET",
            subType: "BANK",
            currency: "USD",
            balanceUsd: 50,
            isActive: false, // Explicitly false
            projectId: project.id
        }
    });

    console.log("Fetching project with dashboard filtering logic...");
    // Imitating dashboard controller query
    const projects = await prisma.project.findMany({
        where: { id: project.id },
        include: {
            accounts: {
                where: {
                    isActive: true
                }
            }
        }
    });

    const p = projects[0];
    console.log(`Found project: ${p.name}`);
    console.log(`Accounts found (should be 1): ${p.accounts.length}`);
    p.accounts.forEach(a => console.log(` - ${a.name} (${a.code}): $${a.balanceUsd} [isActive: ${a.isActive}]`));

    const totalBalance = p.accounts.reduce((sum, a) => sum + (a.balanceUsd || 0), 0);
    console.log(`Total Balance Calculated: $${totalBalance}`);

    if (totalBalance === 100) {
        console.log("✅ TEST PASSED: Inactive account balance ignored.");
    } else {
        console.log("❌ TEST FAILED: Inactive account balance included.");
    }

    // Cleanup
    await prisma.account.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.$disconnect(); 
}

repro().catch(console.error);
