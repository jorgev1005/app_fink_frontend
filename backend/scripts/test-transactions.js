const axios = require('axios');

const API_URL = 'http://localhost:4000/api';

async function createTestTransaction() {
  try {
    // 1. Login
    console.log('\n🔐 Iniciando sesión...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@fink.com',
      password: 'Admin123!'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Sesión iniciada');
    
    // 2. Get projects
    console.log('\n📋 Obteniendo proyectos...');
    const projectsResponse = await axios.get(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const project = projectsResponse.data.data[0];
    console.log(`✅ Proyecto seleccionado: ${project.name} (${project.code})`);
    
    // 3. Get accounts for the project
    console.log('\n💼 Obteniendo cuentas del proyecto...');
    const accountsResponse = await axios.get(`${API_URL}/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { projectId: project.id }
    });
    
    const accounts = accountsResponse.data.data;
    
    // Buscar cuentas específicas
    const cashUsd = accounts.find(a => a.code === '1.1.02'); // Caja USD
    const serviceRevenue = accounts.find(a => a.code === '4.2.01'); // Ingresos por Servicios
    const operationalExpense = accounts.find(a => a.code === '5.1.01'); // Gastos Operacionales
    
    console.log(`✅ ${accounts.length} cuentas encontradas`);
    console.log(`   - Caja USD: ${cashUsd ? cashUsd.name : 'No encontrada'}`);
    console.log(`   - Ingresos por Servicios: ${serviceRevenue ? serviceRevenue.name : 'No encontrada'}`);
    console.log(`   - Gastos Operacionales: ${operationalExpense ? operationalExpense.name : 'No encontrada'}`);
    
    // 4. Crear transacción de ingreso
    if (cashUsd && serviceRevenue) {
      console.log('\n💰 Creando transacción de ingreso...');
      const incomeTransaction = await axios.post(`${API_URL}/transactions`, {
        projectId: project.id,
        type: 'INCOME',
        description: 'Pago por desarrollo de aplicación web',
        reference: 'FAC-2025-001',
        date: new Date().toISOString(),
        currency: 'USD',
        amount: 1500,
        category: 'Servicios',
        subcategory: 'Desarrollo Web',
        entries: [
          {
            debitAccountId: cashUsd.id,
            debitAmount: 1500,
            creditAmount: 0,
            description: 'Ingreso a Caja USD'
          },
          {
            creditAccountId: serviceRevenue.id,
            creditAmount: 1500,
            debitAmount: 0,
            description: 'Registro de ingreso por servicios'
          }
        ]
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Transacción de ingreso creada:');
      console.log(`   - Código: ${incomeTransaction.data.data.code}`);
      console.log(`   - Monto: $${incomeTransaction.data.data.amount}`);
      console.log(`   - Estado: ${incomeTransaction.data.data.status}`);
    }
    
    // 5. Crear transacción de gasto
    if (cashUsd && operationalExpense) {
      console.log('\n💸 Creando transacción de gasto...');
      const expenseTransaction = await axios.post(`${API_URL}/transactions`, {
        projectId: project.id,
        type: 'EXPENSE',
        description: 'Pago de honorarios profesionales',
        reference: 'REC-2025-001',
        date: new Date().toISOString(),
        currency: 'USD',
        amount: 500,
        category: 'Personal',
        subcategory: 'Honorarios',
        entries: [
          {
            debitAccountId: operationalExpense.id,
            debitAmount: 500,
            creditAmount: 0,
            description: 'Registro de gasto operacional'
          },
          {
            creditAccountId: cashUsd.id,
            creditAmount: 500,
            debitAmount: 0,
            description: 'Salida de Caja USD'
          }
        ]
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Transacción de gasto creada:');
      console.log(`   - Código: ${expenseTransaction.data.data.code}`);
      console.log(`   - Monto: $${expenseTransaction.data.data.amount}`);
      console.log(`   - Estado: ${expenseTransaction.data.data.status}`);
    }
    
    // 6. Verificar balances actualizados
    console.log('\n📊 Verificando balances actualizados...');
    const cashAccount = await axios.get(`${API_URL}/accounts/${cashUsd.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Balance de Caja USD:');
    console.log(`   - Balance Bs: ${cashAccount.data.data.balanceBs}`);
    console.log(`   - Balance USD: ${cashAccount.data.data.balanceUsd}`);
    console.log(`   - Balance EUR: ${cashAccount.data.data.balanceEur}`);
    
    // 7. Ver transacciones del proyecto
    console.log('\n📋 Listando transacciones del proyecto...');
    const transactionsResponse = await axios.get(`${API_URL}/transactions`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { projectId: project.id, limit: 10 }
    });
    
    console.log(`✅ ${transactionsResponse.data.data.length} transacciones encontradas:`);
    transactionsResponse.data.data.forEach(t => {
      console.log(`   - ${t.code}: ${t.description} ($${t.amount}) - ${t.status}`);
    });
    
    console.log('\n✨ ¡Prueba completada exitosamente!');
    console.log('🎉 El módulo de transacciones está funcionando correctamente.\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
  }
}

createTestTransaction();
