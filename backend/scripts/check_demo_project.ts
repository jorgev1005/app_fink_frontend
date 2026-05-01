
import prisma from '../src/config/database';

async function checkProject() {
  try {
    const project = await prisma.project.findFirst({
      where: {
        code: 'DEM-01'
      }
    });
    console.log('Project found:', project);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProject();
