/**
 * Script para replicar las cuentas de un proyecto fuente a todos los proyectos
 * que actualmente no tienen cuentas.
 *
 * Uso:
 *  - NODE_ENV=development SOURCE_PROJECT_ID=<id> npx ts-node scripts/replicateAccountsToProjects.ts
 *  - Si no se provee SOURCE_PROJECT_ID, el script tomará el primer proyecto que tenga cuentas
 */
import prisma from '../src/config/database';

async function main() {
  const sourceProjectId = process.env.SOURCE_PROJECT_ID || process.argv[2];

  // Encontrar proyecto fuente
  let sourceProject: any = null;
  if (sourceProjectId) {
    sourceProject = await prisma.project.findUnique({ where: { id: sourceProjectId } });
    if (!sourceProject) {
      console.error('No se encontró el projectId proporcionado:', sourceProjectId);
      process.exit(1);
    }
    const cnt = await prisma.account.count({ where: { projectId: sourceProject.id } });
    if (cnt === 0) {
      console.error('El proyecto fuente no tiene cuentas. Elija otro proyecto.');
      process.exit(1);
    }
  } else {
    // Buscar primer proyecto que tenga cuentas
    const projWithAccounts = await prisma.project.findMany({
      where: { accounts: { some: {} } },
      include: { accounts: true },
      orderBy: { createdAt: 'asc' },
      take: 1
    });
    if (projWithAccounts.length === 0) {
      console.error('No se encontró ningún proyecto con cuentas. Nada que replicar.');
      process.exit(1);
    }
    sourceProject = projWithAccounts[0];
  }

  console.log('Fuente de cuentas:', sourceProject.id, sourceProject.name);

  // Cargar cuentas del proyecto fuente
  const sourceAccounts = await prisma.account.findMany({ where: { projectId: sourceProject.id }, orderBy: { createdAt: 'asc' } });
  if (!sourceAccounts || sourceAccounts.length === 0) {
    console.error('El proyecto fuente no tiene cuentas.');
    process.exit(1);
  }

  // Obtener proyectos que no tienen cuentas
  const allProjects = await prisma.project.findMany({ orderBy: { createdAt: 'asc' } });
  const targetProjects: any[] = [];
  for (const p of allProjects) {
    if (p.id === sourceProject.id) continue;
    const cnt = await prisma.account.count({ where: { projectId: p.id } });
    if (cnt === 0) targetProjects.push(p);
  }

  if (targetProjects.length === 0) {
    console.log('No hay proyectos sin cuentas. Nada que hacer.');
    process.exit(0);
  }

  console.log('Proyectos destino a llenar:', targetProjects.map(p => `${p.id} (${p.name})`).join(', '));

  for (const target of targetProjects) {
    console.log('\nReplicando a proyecto:', target.id, target.name);
    const oldToNew = new Map<string, string>();
    const pending = sourceAccounts.slice();

    let iterations = 0;
    while (pending.length > 0) {
      iterations++;
      if (iterations > 10000) {
        throw new Error('Loop infinito detectado al replicar cuentas');
      }

      let progress = false;
      for (let i = pending.length - 1; i >= 0; i--) {
        const acc = pending[i];
        // Si no tiene padre o ya creamos el padre, podemos crear esta cuenta
        if (!acc.parentId || oldToNew.has(acc.parentId)) {
          const data: any = {
            code: acc.code,
            name: acc.name,
            description: acc.description,
            type: acc.type,
            subType: acc.subType,
            projectId: target.id,
            balanceBs: 0,
            balanceUsd: 0,
            balanceEur: 0,
            isActive: acc.isActive,
          };
          if (acc.parentId) data.parentId = oldToNew.get(acc.parentId) as string;

          const created = await prisma.account.create({ data });
          oldToNew.set(acc.id, created.id);
          pending.splice(i, 1);
          progress = true;
        }
      }
      if (!progress) {
        throw new Error('No se pudo avanzar en la réplica: faltan padres no creados');
      }
    }

    console.log('Cuentas creadas en proyecto', target.id, ':', oldToNew.size);
  }

  console.log('\nReplicación completada.');
}

main()
  .catch(err => {
    console.error('Error en réplica:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
