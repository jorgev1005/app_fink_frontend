
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Definición del Plan de Cuentas Estándar
// Estructura jerárquica sugerida
const STANDARD_ACCOUNTS = [
  // ================= ACTIVOS (1) =================
  { code: '1.1.01', name: 'Caja General', type: 'ASSET', subType: 'CASH' },
  { code: '1.1.01.001', name: 'Caja Chica Bs', type: 'ASSET', subType: 'CASH', parentCode: '1.1.01' },
  { code: '1.1.01.002', name: 'Caja Chica USD', type: 'ASSET', subType: 'CASH', parentCode: '1.1.01' },
  
  { code: '1.1.02', name: 'Bancos Nacionales', type: 'ASSET', subType: 'BANK' },
  { code: '1.1.02.001', name: 'Banco Mercantil', type: 'ASSET', subType: 'BANK', parentCode: '1.1.02' },
  { code: '1.1.02.002', name: 'Banesco', type: 'ASSET', subType: 'BANK', parentCode: '1.1.02' },
  
  { code: '1.1.03', name: 'Bancos Internacionales', type: 'ASSET', subType: 'BANK' },
  { code: '1.1.03.001', name: 'BofA / Zelle', type: 'ASSET', subType: 'BANK', parentCode: '1.1.03' },
  { code: '1.1.03.002', name: 'PayPal', type: 'ASSET', subType: 'BANK', parentCode: '1.1.03' },
  { code: '1.1.03.003', name: 'Binance / USDT', type: 'ASSET', subType: 'BANK', parentCode: '1.1.03' },

  { code: '1.2.01', name: 'Cuentas por Cobrar Clientes', type: 'ASSET', subType: 'ACCOUNTS_RECEIVABLE' },
  { code: '1.3.01', name: 'Inventario de Mercancía', type: 'ASSET', subType: 'INVENTORY' },
  { code: '1.4.01', name: 'Mobiliario y Equipos', type: 'ASSET', subType: 'FIXED_ASSETS' },

  // ================= PASIVOS (2) =================
  { code: '2.1.01', name: 'Cuentas por Pagar Proveedores', type: 'LIABILITY', subType: 'ACCOUNTS_PAYABLE' },
  { code: '2.1.02', name: 'Impuestos por Pagar', type: 'LIABILITY', subType: 'TAXES_PAYABLE' },
  { code: '2.2.01', name: 'Préstamos Bancarios', type: 'LIABILITY', subType: 'LOANS' },

  // ================= PATRIMONIO (3) =================
  { code: '3.1.01', name: 'Capital Social', type: 'EQUITY', subType: 'CAPITAL' },
  { code: '3.2.01', name: 'Resultados Acumulados', type: 'EQUITY', subType: 'RETAINED_EARNINGS' },

  // ================= INGRESOS (4) =================
  { code: '4.1.01', name: 'Ventas de Productos', type: 'REVENUE', subType: 'SALES' },
  { code: '4.1.02', name: 'Ingresos por Servicios', type: 'REVENUE', subType: 'SERVICES' },
  { code: '4.2.01', name: 'Otros Ingresos', type: 'REVENUE', subType: 'OTHER_INCOME' },

  // ================= GASTOS (5) =================
  { code: '5.1.01', name: 'Sueldos y Salarios', type: 'EXPENSE', subType: 'PAYROLL' },
  { code: '5.1.02', name: 'Alquileres', type: 'EXPENSE', subType: 'OPERATIONAL' },
  { code: '5.1.03', name: 'Servicios Públicos (Luz, Agua, Internet)', type: 'EXPENSE', subType: 'OPERATIONAL' },
  { code: '5.1.04', name: 'Mantenimiento y Reparaciones', type: 'EXPENSE', subType: 'OPERATIONAL' },
  { code: '5.1.05', name: 'Publicidad y Mercadeo', type: 'EXPENSE', subType: 'OPERATIONAL' },
  { code: '5.2.01', name: 'Gastos Bancarios', type: 'EXPENSE', subType: 'FINANCIAL' },
  { code: '5.2.02', name: 'Impuestos Municipales', type: 'EXPENSE', subType: 'TAXES' },
  { code: '5.3.01', name: 'Costo de Ventas', type: 'EXPENSE', subType: 'COST_OF_SALES' },
];

async function main() {
  console.log('🚀 Iniciando creación de Plan de Cuentas Estándar...');

  // 1. Obtener todos los proyectos activos
  const projects = await prisma.project.findMany({
    where: { status: 'ACTIVE' }
  });

  console.log(`📋 Encontrados ${projects.length} proyectos activos.`);

  for (const project of projects) {
    console.log(`\n🔹 Procesando proyecto: ${project.name} (${project.code})`);
    
    let createdCount = 0;
    let skippedCount = 0;

    // Procesar cuentas en orden para asegurar que los padres existan primero (aunque el código lo maneja por string matching si es necesario)
    // Ordenamos por longitud de código para crear padres antes que hijos
    const sortedAccounts = [...STANDARD_ACCOUNTS].sort((a, b) => a.code.length - b.code.length);

    for (const accTemplate of sortedAccounts) {
      // Verificar si la cuenta ya existe
      const existingAccount = await prisma.account.findFirst({
        where: {
          projectId: project.id,
          code: accTemplate.code
        }
      });

      if (existingAccount) {
        skippedCount++;
        continue;
      }

      // Buscar el ID del padre si tiene parentCode
      let parentId = null;
      if (accTemplate.parentCode) {
        const parentAccount = await prisma.account.findFirst({
          where: {
            projectId: project.id,
            code: accTemplate.parentCode
          }
        });
        if (parentAccount) {
          parentId = parentAccount.id;
        }
      }

      // Crear la cuenta
      await prisma.account.create({
        data: {
          projectId: project.id,
          code: accTemplate.code,
          name: accTemplate.name,
          type: accTemplate.type,
          subType: accTemplate.subType,
          parentId: parentId,
          balanceBs: 0,
          balanceUsd: 0,
          balanceEur: 0,
        }
      });
      createdCount++;
    }

    console.log(`   ✅ Creadas: ${createdCount} | ⏭️ Omitidas (ya existían): ${skippedCount}`);
  }

  console.log('\n✨ Proceso finalizado exitosamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
