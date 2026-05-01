const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function resetAdminPassword() {
  try {
    const email = 'admin@fink.com';
    const newPassword = 'admin123';
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const user = await prisma.user.upsert({
      where: { email },
      update: { password: hashedPassword },
      create: {
        email,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        isActive: true
      }
    });
    
    console.log(`✓ Admin user ready: ${user.email}`);
    console.log(`  Password: ${newPassword}`);
    console.log(`  Role: ${user.role}`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword();
