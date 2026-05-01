// Script para actualizar el email de un usuario en la base de datos con Prisma
// Ejecutar: node scripts/update-admin-email.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const oldEmail = 'admin@admin.com';
  const newEmail = 'jorge.verenzuela@gmail.com';

  // Verificar si ya existe un usuario con el nuevo email
  const existing = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existing) {
    console.error('Ya existe un usuario con el email destino:', newEmail);
    process.exit(1);
  }

  // Actualizar el email
  const updated = await prisma.user.update({
    where: { email: oldEmail },
    data: { email: newEmail }
  });

  console.log('Usuario actualizado:', updated);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
