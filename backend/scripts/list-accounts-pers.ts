import prisma from '../src/config/database';

async function main() {
  // Find project id for code PERS-001
  const project = await prisma.project.findFirst({ where: { code: 'PERS-001' } });
  if (!project) {
    console.log('Proyecto PERS-001 no encontrado');
    process.exit(0);
  }

  const accounts = await prisma.account.findMany({ where: { projectId: project.id } });
  const simplified = (accounts as any[]).map(a => ({ id: a.id, code: a.code, name: a.name, balanceUsd: a.balanceUsd, balanceBs: a.balanceBs, currency: (a as any).currency ?? null }));
  console.log(JSON.stringify({ project: { id: project.id, code: project.code, name: project.name }, accounts: simplified }, null, 2));
  process.exit(0);
}

main().catch(e=>{ console.error(e); process.exit(1); });
