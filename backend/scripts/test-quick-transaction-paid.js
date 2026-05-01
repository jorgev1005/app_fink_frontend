/**
 * Test script para verificar Option B:
 * Crear una transacción rápida como PAGADA (createAsPending=false)
 * El pago debe crearse atómicamente junto con la transacción
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const API_URL = 'http://localhost:4002/api';

async function main() {
  try {
    console.log('=== Test Option B: Quick Transaction as PAID ===\n');

    // 1. Get admin user
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@fink.com' },
      select: { id: true, email: true }
    });

    if (!adminUser) {
      throw new Error('Admin user not found');
    }
    console.log('✓ Admin user found:', adminUser.email);

    // 2. Login to get JWT token
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@fink.com',
      password: 'admin123'
    });

    const token = loginRes.data.data.token;
    console.log('✓ Login successful, got JWT token\n');

    // 3. Get project
    const project = await prisma.project.findFirst({
      where: { code: 'PERS-001' },
      select: { id: true, code: true, name: true }
    });

    if (!project) {
      throw new Error('Project PERS-001 not found');
    }
    console.log('✓ Project found:', project.code, '-', project.name);

    // 4. Get accounts
    const cashAccount = await prisma.account.findFirst({
      where: { code: '1.1.01' }, // Caja Bs
      select: { id: true, code: true, name: true }
    });

    const incomeAccount = await prisma.account.findFirst({
      where: { code: '4.1.01' }, // Ingresos por Ventas
      select: { id: true, code: true, name: true }
    });

    if (!cashAccount || !incomeAccount) {
      throw new Error('Required accounts not found');
    }

    console.log('✓ Cash account:', cashAccount.code, '-', cashAccount.name);
    console.log('✓ Income account:', incomeAccount.code, '-', incomeAccount.name);
    console.log('');

    // 5. Create quick transaction as PAID (createAsPending=false)
    const transactionPayload = {
      projectId: project.code,
      description: 'Test Quick Transaction - PAID',
      type: 'INCOME',
      amount: 5000,
      currency: 'BS',
      date: new Date().toISOString(),
      entries: [
        {
          debitAccountId: cashAccount.id,
          debitAmount: 5000,
          creditAccountId: null,
          creditAmount: 0,
          description: 'Débito a Caja'
        },
        {
          debitAccountId: null,
          debitAmount: 0,
          creditAccountId: incomeAccount.id,
          creditAmount: 5000,
          description: 'Crédito a Ingresos'
        }
      ],
      createAsPending: false, // ← KEY: This should create payment atomically
      paymentMethod: 'CASH',
      paymentReference: 'TEST-QUICK-PAY-' + Date.now()
    };

    console.log('Creating quick transaction with:');
    console.log('- createAsPending: false (should create payment)');
    console.log('- amount:', transactionPayload.amount, transactionPayload.currency);
    console.log('- paymentMethod:', transactionPayload.paymentMethod);
    console.log('');

    const createRes = await axios.post(`${API_URL}/transactions`, transactionPayload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const createdTransaction = createRes.data.data;
    console.log('✓ Transaction created successfully!');
    console.log('  ID:', createdTransaction.id);
    console.log('  Code:', createdTransaction.code);
    console.log('  Amount:', createdTransaction.amount);
    console.log('  Currency:', createdTransaction.currency);
    console.log('  Payment Status:', createdTransaction.paymentStatus);
    console.log('  Amount Paid:', createdTransaction.amountPaid);
    console.log('');

    // 6. Verify payment was created
    const payment = await prisma.payment.findFirst({
      where: {
        allocations: {
          some: { transactionId: createdTransaction.id }
        }
      },
      include: {
        allocations: {
          where: { transactionId: createdTransaction.id }
        }
      }
    });

    if (!payment) {
      console.error('❌ ERROR: Payment was NOT created!');
      console.error('Expected a Payment record linked to transaction', createdTransaction.id);
      process.exit(1);
    }

    console.log('✓ Payment created successfully!');
    console.log('  ID:', payment.id);
    console.log('  Code:', payment.code);
    console.log('  Amount:', payment.amount);
    console.log('  Currency:', payment.currency);
    console.log('  Method:', payment.method);
    console.log('  Reference:', payment.reference);
    console.log('  Status:', payment.status);
    console.log('');

    // 7. Verify payment allocation
    if (payment.allocations.length === 0) {
      console.error('❌ ERROR: PaymentAllocation was NOT created!');
      process.exit(1);
    }

    const allocation = payment.allocations[0];
    console.log('✓ PaymentAllocation created successfully!');
    console.log('  ID:', allocation.id);
    console.log('  Allocated Amount:', allocation.allocatedAmount);
    console.log('');

    // 8. Verify transaction status
    const updatedTransaction = await prisma.transaction.findUnique({
      where: { id: createdTransaction.id },
      select: {
        id: true,
        code: true,
        amount: true,
        amountPaid: true,
        paymentStatus: true
      }
    });

    console.log('✓ Transaction payment status verified:');
    console.log('  Amount:', updatedTransaction.amount);
    console.log('  Amount Paid:', updatedTransaction.amountPaid);
    console.log('  Payment Status:', updatedTransaction.paymentStatus);
    console.log('');

    // 9. Validation
    const isValid = 
      updatedTransaction.paymentStatus === 'PAID' &&
      Number(updatedTransaction.amountPaid) === Number(updatedTransaction.amount);

    if (isValid) {
      console.log('✅ SUCCESS: Option B working correctly!');
      console.log('   Transaction created as PAID with atomic payment creation');
    } else {
      console.error('❌ ERROR: Validation failed!');
      console.error('   Expected paymentStatus=PAID, got:', updatedTransaction.paymentStatus);
      console.error('   Expected amountPaid=amount, got:', updatedTransaction.amountPaid, '≠', updatedTransaction.amount);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test failed:');
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.statusText);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
