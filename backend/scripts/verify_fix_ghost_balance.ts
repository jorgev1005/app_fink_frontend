
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Starting verification...");

    // 1. Create a dummy user
    const userEmail = `test_ghost_${Date.now()}@example.com`;
    const user = await prisma.user.create({
        data: {
            email: userEmail,
            password: 'password123',
            firstName: 'Test',
            lastName: 'Ghost',
            role: 'ADMIN' // or whatever
        }
    });
    console.log(`Created user: ${user.id}`);

    // 2. Create a project linked to this user
    const project = await prisma.project.create({
        data: {
            name: 'Ghost Balance Project',
            code: `GHOST-${Date.now()}`,
            description: 'Test project for ghost balance',
            status: 'ACTIVE',
            users: {
                create: {
                    user: { connect: { id: user.id } },
                    role: 'OWNER'
                }
            }
        }
    });
    console.log(`Created project: ${project.id}`);

    // 3. Create Active Account with balance 1000 USD
    await prisma.account.create({
        data: {
            code: `ACC-ACTIVE-${Date.now()}`,
            name: 'Active Account',
            type: 'ASSET', // Valid enum value
            subType: 'BANK',
            currency: 'USD',
            balanceUsd: 1000,
            balanceBs: 0,
            balanceEur: 0,
            isActive: true,
            projectId: project.id
        }
    });
    console.log("Created Active account with balance 1000 USD");

    // 4. Create Inactive Account with balance 5000 USD (The Ghost)
    await prisma.account.create({
        data: {
            code: `ACC-INACTIVE-${Date.now()}`,
            name: 'Inactive Account',
            type: 'ASSET',
            subType: 'BANK',
            currency: 'USD',
            balanceUsd: 5000,
            balanceBs: 0,
            balanceEur: 0,
            isActive: false, // THIS IS THE KEY
            projectId: project.id
        }
    });
    console.log("Created Inactive account with balance 5000 USD");

    // 5. Execute the query from dashboard.controller.ts
    // We simulate the req.user!.id being our new user's id
    const projects = await prisma.project.findMany({
      where: {
        users: {
          some: {
            userId: user.id
          }
        },
        status: 'ACTIVE'
      },
      include: {
        // We only care about accounts for this test
        accounts: {
          where: {
            isActive: true
          }
        }
      }
    });

    // 6. Verify
    let totalBalance = 0;
    let accountsFound = 0;
    
    projects.forEach(p => {
        p.accounts.forEach(a => {
            accountsFound++;
            console.log(`Found account: ${a.name} (Active: ${a.isActive}, Balance: ${a.balanceUsd})`);
            totalBalance += (a.balanceUsd || 0);
        });
    });

    console.log(`\nTotal Calculated Balance from Query: ${totalBalance}`);
    
    if (totalBalance === 1000 && accountsFound === 1) {
        console.log("SUCCESS: Ghost balance is ignored!");
    } else {
        console.error("FAILURE: Ghost balance is included or active account missing.");
        console.error(`Expected 1000, got ${totalBalance}`);
        console.error(`Expected 1 account, got ${accountsFound}`);
        process.exit(1);
    }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
