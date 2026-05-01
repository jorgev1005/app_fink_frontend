// scripts/debug_accounts_api.ts
import prisma from '../src/config/database';

async function main() {
    console.log('Fetching accounts...');
    // Simulate what the frontend gets for the project
    // First get a project ID.
    const project = await prisma.project.findFirst({
        where: { name: 'SmartERP Test' } 
    });

    if (!project) {
        console.log("No test project found.");
        return;
    }

    const accounts = await prisma.account.findMany({
        where: { projectId: project.id }
    });

    console.table(accounts.map(a => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        type: a.type
    })));
}

main();
