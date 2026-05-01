// Script para inicializar datos de prueba en el sistema FINK
const axios = require('axios');

const API_URL = 'http://localhost:4001/api';
let authToken = '';

// Función auxiliar para hacer peticiones autenticadas
const apiCall = async (method, endpoint, data = null) => {
  const config = {
    method,
    url: `${API_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` })
    },
    ...(data && { data })
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error en ${method} ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
};

// 1. Login como admin
const login = async () => {
  console.log('\n🔐 1. Iniciando sesión como administrador...');
  const response = await apiCall('post', '/auth/login', {
    email: 'admin@fink.com',
    password: 'Admin123!'
  });
  authToken = response.data.token;
  console.log('✅ Sesión iniciada correctamente');
  console.log(`   Usuario: ${response.data.user.firstName} ${response.data.user.lastName}`);
};

// 2. Actualizar tasas de cambio
const updateExchangeRates = async () => {
  console.log('\n💱 2. Actualizando tasas de cambio...');
  
  try {
    // Intentar obtener desde BCV
    await apiCall('post', '/exchange-rates/update');
    console.log('✅ Tasas actualizadas desde BCV');
  } catch (error) {
    // Si falla, crear tasas manualmente
    console.log('⚠️  No se pudo conectar con BCV, creando tasas manualmente...');
    
    const rates = [
      { currency: 'USD', rate: 36.50, source: 'MANUAL' },
      { currency: 'EUR', rate: 39.80, source: 'MANUAL' }
    ];

    for (const rateData of rates) {
      await apiCall('post', '/exchange-rates', rateData);
    }
    console.log('✅ Tasas de cambio creadas manualmente');
  }

  // Mostrar tasas actuales
  const latest = await apiCall('get', '/exchange-rates/latest');
  console.log('\n   Tasas actuales:');
  latest.data.forEach(rate => {
    console.log(`   - ${rate.currency}: Bs ${rate.rate} (${rate.source})`);
  });
};

// 3. Crear proyectos
const createProjects = async () => {
  console.log('\n🏢 3. Creando proyectos de prueba...');
  
  const projects = [
    {
      name: 'Desarrollo Web',
      description: 'Proyecto de desarrollo de aplicaciones web',
      code: 'DEV-WEB-001',
      initialCapitalUsd: 50000,
      initialCapitalBs: 1825000,
      status: 'ACTIVE',
      color: '#3B82F6'
    },
    {
      name: 'Consultoría TI',
      description: 'Servicios de consultoría en tecnología',
      code: 'CONS-TI-002',
      initialCapitalUsd: 30000,
      initialCapitalBs: 1095000,
      status: 'ACTIVE',
      color: '#10B981'
    },
    {
      name: 'Tienda Online',
      description: 'E-commerce de productos digitales',
      code: 'ECOM-001',
      initialCapitalUsd: 25000,
      initialCapitalBs: 912500,
      status: 'ACTIVE',
      color: '#F59E0B'
    }
  ];

  const createdProjects = [];
  for (const projectData of projects) {
    const response = await apiCall('post', '/projects', projectData);
    createdProjects.push(response.data);
    console.log(`✅ Proyecto creado: ${projectData.name}`);
    console.log(`   Código: ${projectData.code}`);
    console.log(`   Capital Inicial: USD ${projectData.initialCapitalUsd.toLocaleString()} / Bs ${projectData.initialCapitalBs.toLocaleString()}`);
  }

  return createdProjects;
};

// 4. Crear cuentas para los proyectos (simplificado por ahora)
const createAccounts = async (projects) => {
  console.log('\n💼 4. Inicializando cuentas básicas...');
  console.log('   (Las cuentas se crearán según el plan contable completo más adelante)');
  return [];
};

// 5. Crear transacciones de ejemplo (simplificado por ahora)
const createTransactions = async (projects, accounts) => {
  console.log('\n💰 5. Sistema de transacciones listo...');
  console.log('   (Las transacciones se registrarán usando el sistema de partida doble)');
};

// 6. Mostrar resumen final
const showSummary = async (projects) => {
  console.log('\n📊 6. Resumen del sistema...\n');
  
  console.log('═══════════════════════════════════════════════════');
  console.log('           RESUMEN DEL SISTEMA FINK');
  console.log('═══════════════════════════════════════════════════\n');

  // Proyectos
  console.log('📁 PROYECTOS CREADOS:');
  for (const project of projects) {
    console.log(`\n   • ${project.name} (${project.code})`);
    console.log(`     ID: ${project.id}`);
    console.log(`     Estado: ${project.status}`);
    console.log(`     Capital Inicial USD: $${project.initialCapitalUsd.toLocaleString()}`);
    console.log(`     Capital Inicial Bs: ${project.initialCapitalBs.toLocaleString()}`);
  }

  // Tasas de cambio
  console.log('\n\n💱 TASAS DE CAMBIO:');
  console.log('   • El sistema obtiene tasas del BCV automáticamente');
  console.log('   • Actualización diaria mediante cron job');
  console.log('   • Endpoint: GET /api/exchange-rates/latest');

  console.log('\n═══════════════════════════════════════════════════');
  console.log('\n✅ Sistema inicializado correctamente!\n');
  console.log('🌐 Puedes acceder al dashboard en: http://localhost:3000');
  console.log('🔐 Credenciales: admin@fink.com / Admin123!\n');
};

// Ejecutar todo
const main = async () => {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║    FINK - Inicialización de Datos de Prueba      ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  try {
    await login();
    console.log('\n💱 2. Tasas de cambio...');
    console.log('   (El sistema usará las tasas del BCV automáticamente)');
    console.log('   Se actualizan mediante cron job diariamente');
    
    const projects = await createProjects();
    await showSummary(projects);

    console.log('\n🎉 ¡Inicialización completada con éxito!\n');
    console.log('📝 Próximos pasos:');
    console.log('   1. Accede al dashboard en http://localhost:3000');
    console.log('   2. Los proyectos ya están creados y listos');
    console.log('   3. El sistema de contabilidad por partida doble está configurado');
    console.log('   4. Las transacciones se registrarán con débitos y créditos\n');
  } catch (error) {
    console.error('\n❌ Error durante la inicialización:', error.message);
    process.exit(1);
  }
};

main();
