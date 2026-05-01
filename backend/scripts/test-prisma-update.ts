
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Create a dummy project with a logoUrl
  const p = await prisma.project.create({
    data: {
      name: 'Test ProjectLogo',
      code: 'TPL-' + Date.now(),
      logoUrl: '/uploads/logos/test.png'
    }
  });
  console.log('Created:', p.logoUrl);

  // 2. Update it without logoUrl in payload
  const updated = await prisma.project.update({
    where: { id: p.id },
    data: {
        name: 'Test ProjectLogo Updated'
        // No logoUrl
    }
  });
  console.log('Updated (no logoUrl in payload):', updated.logoUrl);

  // 3. Update with logoUrl explicitly
  const updated2 = await prisma.project.update({
      where: { id: p.id },
      data: {
          logoUrl: '/uploads/logos/test-2.png'
      }
  });
  console.log('Updated (with logoUrl):', updated2.logoUrl);
  
  // Cleanup
  await prisma.project.delete({ where: { id: p.id } });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
