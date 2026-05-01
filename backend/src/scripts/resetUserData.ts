import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetUserData(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { 
    console.error('Usuario no encontrado.'); 
    return; 
  }
  
  const pUsers = await prisma.projectUser.findMany({ where: { userId: user.id } });
  const projectIds = pUsers.map(pu => pu.projectId);
  if (!projectIds.length) { 
    console.log('No hay proyectos asociados al usuario.'); 
    return; 
  }
  
  console.log(`Iniciando limpieza para ${projectIds.length} proyectos del usuario ${email}...`);
  for (const pId of projectIds) {
    // 1. Borrar pagos, facturas y documentos
    await prisma.payment.deleteMany({ where: { projectId: pId } });
    await prisma.invoice.deleteMany({ where: { projectId: pId } });
    await prisma.document.deleteMany({ where: { projectId: pId } });
    
    // 2. Borrar transacciones y plantillas
    await prisma.transaction.deleteMany({ where: { projectId: pId } });
    await prisma.transactionTemplate.deleteMany({ where: { projectId: pId } });
    
    // 3. Borrar reglas recurrentes
    await prisma.recurringRule.deleteMany({ where: { projectId: pId } });
    
    // 4. Reiniciar cuentas a 0 sin borrarlas
    await prisma.account.updateMany({ 
      where: { projectId: pId }, 
      data: { balanceBs: 0, balanceUsd: 0, balanceEur: 0 } 
    });
    
    // 5. Reiniciar secuencias código de transacción
    await prisma.transactionCodeSequence.updateMany({ 
      where: { projectId: pId }, 
      data: { lastCode: 0 } 
    });
    
    console.log(`✔ Proyecto ${pId} limpiado completamente`);
  }
  console.log('¡Proceso finalizado! Entornos en blanco listos.');
}

const args = process.argv.slice(2);
const email = args[0] || 'jorge.verenzuela@gmail.com';

resetUserData(email).finally(() => prisma.$disconnect());
