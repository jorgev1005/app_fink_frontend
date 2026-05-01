import prisma from '../src/config/database';

async function main() {
  const project = await prisma.project.findFirst({ where: { code: 'DEMO' } });
  if (!project) {
    console.error('No project with code DEMO found. Run seedDemo first.');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: 'ci_test@example.com' } });
  if (!user) {
    console.error('User ci_test@example.com not found. Create the test user first.');
    process.exit(1);
  }

  const existing = await prisma.projectUser.findFirst({ where: { projectId: project.id, userId: user.id } });
  if (existing) {
    console.log('User already linked to project.');
    process.exit(0);
  }

  await prisma.projectUser.create({ data: { projectId: project.id, userId: user.id, role: 'owner' } });
  console.log('Linked user', user.email, 'to project', project.code);
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() });
