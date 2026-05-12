const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function run() { 
  const p = await prisma.project.findMany({ select: { id: true, name: true }}); 
  console.log("Proyectos disponibles:", p);

  // We want to find the ID for "Personal"
  const personalProject = p.find(x => x.name.toLowerCase().includes('personal') || x.name.toLowerCase().includes('jorge'));
  if (personalProject) {
    console.log("Found Personal:", personalProject);
    // Update the transaction
    const t = await prisma.transaction.update({
        where: { code: 'BOT-1777855540584' },
        data: { projectId: personalProject.id }
    });
    console.log("Actualizado a Personal!", t.code, t.projectId);
  } else {
    console.log("No personal project found.");
  }
} 
run().catch(console.error).finally(() => prisma.$disconnect());