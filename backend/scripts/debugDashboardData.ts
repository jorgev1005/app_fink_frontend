import prisma from '../src/config/database';

async function main() {
  const email = process.env.EMAIL || 'ci_test@example.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }

  console.log('User:', user.email, user.id);

  // Projects linked to user
  const projects = await prisma.project.findMany({
    where: {
      users: { some: { userId: user.id } }
    },
    include: {
      accounts: true,
      transactions: true
    }
  });

  if (!projects || projects.length === 0) {
    console.log('No projects linked to user');
  }

  let overallAccountsUsd = 0;
  let overallAccountsBs = 0;

  for (const p of projects) {
    console.log('\nProject:', p.id, p.code, p.name);
    const accounts = p.accounts || [];
    let projUsd = 0;
    let projBs = 0;
    for (const a of accounts) {
      // balance fields are Decimal in Prisma; convert to string then number
      const bUsd = Number((a as any).balanceUsd || 0);
      const bBs = Number((a as any).balanceBs || 0);
      projUsd += bUsd;
      projBs += bBs;
      console.log(`  Account ${a.id} | code=${a.code} name=${a.name} parent=${a.parentId} active=${a.isActive} balanceUsd=${bUsd} balanceBs=${bBs}`);
    }
    console.log(`  Project accounts sum: USD=${projUsd} BS=${projBs}`);
    overallAccountsUsd += projUsd;
    overallAccountsBs += projBs;
  }

  console.log('\nOverall accounts sum for user projects: USD=', overallAccountsUsd, ' BS=', overallAccountsBs);

  // Also list any accounts with non-zero balance that belong to projects NOT linked to the user
  const accountsNonZero = await prisma.account.findMany({ where: { OR: [ { balanceUsd: { not: 0 } }, { balanceBs: { not: 0 } } ] } });
  console.log('\nAll accounts with non-zero balance (count=' + accountsNonZero.length + '):');
  for (const a of accountsNonZero) {
    console.log(`  acc ${a.id} project=${a.projectId} code=${a.code} name=${a.name} usd=${(a as any).balanceUsd} bs=${(a as any).balanceBs}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
