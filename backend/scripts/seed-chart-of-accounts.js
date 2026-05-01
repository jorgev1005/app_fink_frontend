const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const API_URL = 'http://localhost:4001/api';

// Catálogo de cuentas estándar según principios contables
// Usando los AccountSubType del schema de Prisma
const CHART_OF_ACCOUNTS = [
  // ACTIVOS
  { code: '1.1.01', name: 'Caja Bs', type: 'ASSET', subType: 'CASH' },
  { code: '1.1.02', name: 'Caja USD', type: 'ASSET', subType: 'CASH' },
  { code: '1.1.03', name: 'Caja EUR', type: 'ASSET', subType: 'CASH' },
  { code: '1.2.01', name: 'Banco Bs', type: 'ASSET', subType: 'BANK' },
  { code: '1.2.02', name: 'Banco USD', type: 'ASSET', subType: 'BANK' },
  { code: '1.2.03', name: 'Banco EUR', type: 'ASSET', subType: 'BANK' },
  { code: '1.3.01', name: 'Cuentas por Cobrar', type: 'ASSET', subType: 'ACCOUNTS_RECEIVABLE' },
  { code: '1.4.01', name: 'Inventario', type: 'ASSET', subType: 'INVENTORY' },
  { code: '1.5.01', name: 'Equipos y Activos Fijos', type: 'ASSET', subType: 'FIXED_ASSETS' },
  
  // PASIVOS
  { code: '2.1.01', name: 'Cuentas por Pagar', type: 'LIABILITY', subType: 'ACCOUNTS_PAYABLE' },
  { code: '2.2.01', name: 'Préstamos y Financiamiento', type: 'LIABILITY', subType: 'LOANS' },
  { code: '2.3.01', name: 'Impuestos por Pagar', type: 'LIABILITY', subType: 'TAXES_PAYABLE' },
  
  // PATRIMONIO
  { code: '3.1.01', name: 'Capital Social', type: 'EQUITY', subType: 'CAPITAL' },
  { code: '3.2.01', name: 'Utilidades Retenidas', type: 'EQUITY', subType: 'RETAINED_EARNINGS' },
  
  // INGRESOS
  { code: '4.1.01', name: 'Ingresos por Ventas', type: 'REVENUE', subType: 'SALES' },
  { code: '4.2.01', name: 'Ingresos por Servicios', type: 'REVENUE', subType: 'SERVICES' },
  { code: '4.3.01', name: 'Otros Ingresos', type: 'REVENUE', subType: 'OTHER_INCOME' },
  
  // GASTOS
  { code: '5.1.01', name: 'Gastos Operacionales', type: 'EXPENSE', subType: 'OPERATIONAL' },
  { code: '5.2.01', name: 'Gastos Administrativos', type: 'EXPENSE', subType: 'ADMINISTRATIVE' },
  { code: '5.3.01', name: 'Gastos Financieros', type: 'EXPENSE', subType: 'FINANCIAL' },
  { code: '5.4.01', name: 'Costo de Ventas', type: 'EXPENSE', subType: 'COST_OF_SALES' },
];

async function login() {
  console.log('\n🔐 Iniciando sesión...');
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@fink.com',
      password: 'Admin123!'
    });
    
    if (response.data.success) {
      console.log('✅ Sesión iniciada correctamente');
      return response.data.data.token;
    }
  } catch (error) {
    console.error('❌ Error al iniciar sesión:', error.response?.data || error.message);
    throw error;
  }
}

async function getProjects(token) {
  console.log('\n📋 Obteniendo proyectos...');
  try {
    const response = await axios.get(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.data.success) {
      console.log(`✅ ${response.data.data.length} proyectos encontrados`);
      return response.data.data;
    }
  } catch (error) {
    console.error('❌ Error al obtener proyectos:', error.response?.data || error.message);
    throw error;
  }
}

async function createAccountsForProject(projectId, projectName) {
  console.log(`\n💼 Creando cuentas para: ${projectName}`);
  
  let created = 0;
  let skipped = 0;
  
  for (const accountTemplate of CHART_OF_ACCOUNTS) {
    try {
      // Verificar si la cuenta ya existe
      const existing = await prisma.account.findFirst({
        where: {
          project: {
            id: projectId
          },
          code: accountTemplate.code
        }
      });
      
      if (existing) {
        skipped++;
        continue;
      }
      
      // Crear la cuenta
      await prisma.account.create({
        data: {
          code: accountTemplate.code,
          name: accountTemplate.name,
          type: accountTemplate.type,
          subType: accountTemplate.subType,
          balanceBs: 0,
          balanceUsd: 0,
          balanceEur: 0,
          isActive: true,
          project: {
            connect: { id: projectId }
          }
        }
      });
      
      created++;
    } catch (error) {
      console.error(`   ❌ Error creando cuenta ${accountTemplate.code}:`, error.message);
    }
  }
  
  console.log(`   ✅ ${created} cuentas creadas, ${skipped} ya existían`);
  return { created, skipped };
}

async function initializeCapital(projectId, projectData) {
  console.log(`\n💰 Inicializando capital para: ${projectData.name}`);
  
  try {
    // Buscar cuentas de capital y caja
    const capitalAccount = await prisma.account.findFirst({
      where: { 
        project: { id: projectId },
        code: '3.1.01' // Capital Social
      }
    });
    
    const cashBsAccount = await prisma.account.findFirst({
      where: { 
        project: { id: projectId },
        code: '1.1.01' // Caja Bs
      }
    });
    
    const cashUsdAccount = await prisma.account.findFirst({
      where: { 
        project: { id: projectId },
        code: '1.1.02' // Caja USD
      }
    });
    
    const cashEurAccount = await prisma.account.findFirst({
      where: { 
        project: { id: projectId },
        code: '1.1.03' // Caja EUR
      }
    });
    
    if (!capitalAccount) {
      console.log('   ⚠️  Cuenta de capital no encontrada');
      return;
    }
    
    // Verificar si ya hay transacciones de capital inicial
    const existingTransactions = await prisma.transaction.count({
      where: {
        projectId,
        description: { contains: 'Aporte inicial de capital' }
      }
    });
    
    if (existingTransactions > 0) {
      console.log('   ℹ️  Capital inicial ya registrado');
      return;
    }
    
    // Obtener el usuario admin
    const adminUser = await prisma.user.findFirst({
      where: { email: 'admin@fink.com' }
    });
    
    if (!adminUser) {
      console.log('   ⚠️  Usuario admin no encontrado');
      return;
    }
    
    let transactionCounter = 1;
    
    // Crear transacción de capital inicial en Bs
    if (projectData.initialCapitalBs > 0 && cashBsAccount) {
      const transaction = await prisma.transaction.create({
        data: {
          code: `TRX-${projectData.code}-${String(transactionCounter++).padStart(4, '0')}`,
          type: 'INCOME',
          description: 'Aporte inicial de capital en Bolívares',
          date: new Date(),
          currency: 'BS',
          amount: projectData.initialCapitalBs,
          amountBs: projectData.initialCapitalBs,
          amountUsd: 0,
          amountEur: 0,
          status: 'COMPLETED',
          reference: `CAP-INIT-BS-${projectData.code}`,
          project: {
            connect: { id: projectId }
          },
          user: {
            connect: { id: adminUser.id }
          },
          entries: {
            create: [
              {
                debitAccount: {
                  connect: { id: cashBsAccount.id }
                },
                debitAmount: projectData.initialCapitalBs,
                creditAmount: 0,
                description: 'Débito en Caja Bs'
              },
              {
                creditAccount: {
                  connect: { id: capitalAccount.id }
                },
                creditAmount: projectData.initialCapitalBs,
                debitAmount: 0,
                description: 'Crédito en Capital Social'
              }
            ]
          }
        }
      });
      
      // Actualizar balances
      await prisma.account.update({
        where: { id: cashBsAccount.id },
        data: { balanceBs: { increment: projectData.initialCapitalBs } }
      });
      
      await prisma.account.update({
        where: { id: capitalAccount.id },
        data: { balanceBs: { increment: projectData.initialCapitalBs } }
      });
      
      console.log(`   ✅ Capital Bs: ${projectData.initialCapitalBs.toLocaleString()} registrado`);
    }
    
    // Crear transacción de capital inicial en USD
    if (projectData.initialCapitalUsd > 0 && cashUsdAccount) {
      const transaction = await prisma.transaction.create({
        data: {
          code: `TRX-${projectData.code}-${String(transactionCounter++).padStart(4, '0')}`,
          type: 'INCOME',
          description: 'Aporte inicial de capital en Dólares',
          date: new Date(),
          currency: 'USD',
          amount: projectData.initialCapitalUsd,
          amountBs: 0,
          amountUsd: projectData.initialCapitalUsd,
          amountEur: 0,
          status: 'COMPLETED',
          reference: `CAP-INIT-USD-${projectData.code}`,
          project: {
            connect: { id: projectId }
          },
          user: {
            connect: { id: adminUser.id }
          },
          entries: {
            create: [
              {
                debitAccount: {
                  connect: { id: cashUsdAccount.id }
                },
                debitAmount: projectData.initialCapitalUsd,
                creditAmount: 0,
                description: 'Débito en Caja USD'
              },
              {
                creditAccount: {
                  connect: { id: capitalAccount.id }
                },
                creditAmount: projectData.initialCapitalUsd,
                debitAmount: 0,
                description: 'Crédito en Capital Social'
              }
            ]
          }
        }
      });
      
      await prisma.account.update({
        where: { id: cashUsdAccount.id },
        data: { balanceUsd: { increment: projectData.initialCapitalUsd } }
      });
      
      await prisma.account.update({
        where: { id: capitalAccount.id },
        data: { balanceUsd: { increment: projectData.initialCapitalUsd } }
      });
      
      console.log(`   ✅ Capital USD: $${projectData.initialCapitalUsd.toLocaleString()} registrado`);
    }
    
    // Crear transacción de capital inicial en EUR
    if (projectData.initialCapitalEur > 0 && cashEurAccount) {
      const transaction = await prisma.transaction.create({
        data: {
          code: `TRX-${projectData.code}-${String(transactionCounter++).padStart(4, '0')}`,
          type: 'INCOME',
          description: 'Aporte inicial de capital en Euros',
          date: new Date(),
          currency: 'EUR',
          amount: projectData.initialCapitalEur,
          amountBs: 0,
          amountUsd: 0,
          amountEur: projectData.initialCapitalEur,
          status: 'COMPLETED',
          reference: `CAP-INIT-EUR-${projectData.code}`,
          project: {
            connect: { id: projectId }
          },
          user: {
            connect: { id: adminUser.id }
          },
          entries: {
            create: [
              {
                debitAccount: {
                  connect: { id: cashEurAccount.id }
                },
                debitAmount: projectData.initialCapitalEur,
                creditAmount: 0,
                description: 'Débito en Caja EUR'
              },
              {
                creditAccount: {
                  connect: { id: capitalAccount.id }
                },
                creditAmount: projectData.initialCapitalEur,
                debitAmount: 0,
                description: 'Crédito en Capital Social'
              }
            ]
          }
        }
      });
      
      await prisma.account.update({
        where: { id: cashEurAccount.id },
        data: { balanceEur: { increment: projectData.initialCapitalEur } }
      });
      
      await prisma.account.update({
        where: { id: capitalAccount.id },
        data: { balanceEur: { increment: projectData.initialCapitalEur } }
      });
      
      console.log(`   ✅ Capital EUR: €${projectData.initialCapitalEur.toLocaleString()} registrado`);
    }
    
  } catch (error) {
    console.error('   ❌ Error inicializando capital:', error.message);
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   FINK - Inicialización de Catálogo de Cuentas       ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  try {
    const token = await login();
    const projects = await getProjects(token);
    
    console.log(`\n📊 Cuentas a crear por proyecto: ${CHART_OF_ACCOUNTS.length}`);
    console.log('   Categorías: Activos, Pasivos, Patrimonio, Ingresos, Gastos');
    
    let totalCreated = 0;
    let totalSkipped = 0;
    
    for (const project of projects) {
      const result = await createAccountsForProject(project.id, project.name);
      totalCreated += result.created;
      totalSkipped += result.skipped;
      
      // Inicializar capital
      await initializeCapital(project.id, project);
    }
    
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                    RESUMEN FINAL                       ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`  ✅ Total cuentas creadas: ${totalCreated}`);
    console.log(`  ℹ️  Total cuentas existentes: ${totalSkipped}`);
    console.log(`  🏢 Proyectos procesados: ${projects.length}`);
    console.log('\n✨ Sistema contable listo para usar!\n');
    
  } catch (error) {
    console.error('\n❌ Error durante la inicialización:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
