// Script para actualizar el nombre de un usuario en la base de datos con Prisma
// Ejecutar: node scripts/update-user-name.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'jorge.verenzuela@gmail.com';
  const firstName = 'Jorge';
  const lastName = 'Verenzuela';

  // Actualizar el nombre
  const updated = await prisma.user.update({
    where: { email: email },
    data: { firstName, lastName }
  });

  console.log('Usuario actualizado:', updated);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
