process.env.DATABASE_URL = "postgresql://grupoal1_finkuser:H3,z,gsjh7VxdVd_@localhost:5432/grupoal1_finkdb";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    where: {
      name: { contains: 'Lucem', mode: 'insensitive' }
    }
  });

  console.log('--- PROYECTOS LUCEM ---');
  console.log(projects);

  for (const p of projects) {
    console.log(`\n=== INVOICES DEL PROYECTO: ${p.name} (ID: ${p.id}) ===`);
    const invoices = await prisma.invoice.findMany({
      where: { projectId: p.id },
      select: {
        id: true,
        code: true,
        type: true,
        total: true,
        createdAt: true,
        lines: true
      },
      orderBy: { createdAt: 'asc' }
    });

    console.table(invoices.map(i => ({
      code: i.code,
      type: i.type,
      total: i.total,
      createdAt: i.createdAt.toISOString()
    })));
  }

  // Verificar si existen códigos 0197 y 0198 en cualquier proyecto
  console.log('\n--- VERIFICANDO CÓDIGOS 0196, 0197, 0198, 0199, 0200, 0201 GLOBALES ---');
  const globalInvoices = await prisma.invoice.findMany({
    where: {
      code: { in: ['0196', '0197', '0198', '0199', '0200', '0201', '196', '197', '198', '199', '200', '201'] }
    },
    select: {
      id: true,
      code: true,
      projectId: true,
      createdAt: true,
      project: { select: { name: true } }
    }
  });
  console.table(globalInvoices.map(gi => ({
    code: gi.code,
    projectName: gi.project?.name,
    createdAt: gi.createdAt.toISOString()
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
