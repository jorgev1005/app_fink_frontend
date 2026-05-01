import prisma from '../src/config/database';

async function main() {
  const email = process.env.EMAIL || 'ci_test@example.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }

  // Find projects that have at least one account
  const projects = await prisma.project.findMany({
    where: { accounts: { some: {} } },
    select: { id: true, code: true }
  });

  console.log('Projects with accounts:', projects.map(p => p.code).join(', '));

  let linked = 0;
  for (const p of projects) {
    const exists = await prisma.projectUser.findFirst({ where: { projectId: p.id, userId: user.id } });
    if (!exists) {
      await prisma.projectUser.create({ data: { projectId: p.id, userId: user.id, role: 'member' } });
      linked++;
      console.log('Linked user to project', p.code);
    }
  }

  console.log(`Linked user to ${linked} new projects`);
}

main().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() });
