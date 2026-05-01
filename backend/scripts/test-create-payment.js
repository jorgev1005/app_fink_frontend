const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
require('dotenv').config();

const prisma = new PrismaClient();

async function testCreatePayment() {
  try {
    console.log('=== Test: Create Payment ===\n');

    // 1. Get a user - prefer admin user
    let user = await prisma.user.findUnique({ where: { email: 'admin@fink.com' } });
    if (!user) {
      user = await prisma.user.findFirst({ where: { isActive: true } });
    }
    if (!user) {
      console.log('❌ No active user found. Please create a user first.');
      return;
    }
    console.log(`✓ Found user: ${user.email} (${user.id})`);

    // 2. Get a project
    const project = await prisma.project.findFirst({ where: { status: 'ACTIVE' } });
    if (!project) {
      console.log('❌ No active project found. Please create a project first.');
      return;
    }
    console.log(`✓ Found project: ${project.name} (code: ${project.code})`);

    // 3. Get or create a test transaction
    let transaction = await prisma.transaction.findFirst({
      where: {
        projectId: project.id,
        type: 'EXPENSE',
        status: 'COMPLETED',
        paymentStatus: 'PENDING',
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!transaction) {
      console.log('No pending transaction found. Creating a test transaction...');
      
      // Get or create test accounts
      let debitAccount = await prisma.account.findFirst({
        where: { projectId: project.id, type: 'EXPENSE' }
      });
      let creditAccount = await prisma.account.findFirst({
        where: { projectId: project.id, type: 'ASSET', subType: 'BANK' }
      });

      if (!debitAccount || !creditAccount) {
        console.log('❌ Required accounts not found. Please set up accounts first.');
        return;
      }

      const txCount = await prisma.transaction.count({ where: { projectId: project.id } });
      const code = `TRX-${project.code}-${String(txCount + 1).padStart(4, '0')}`;

      transaction = await prisma.transaction.create({
        data: {
          code,
          type: 'EXPENSE',
          status: 'COMPLETED',
          description: 'Test expense for payment',
          date: new Date(),
          currency: 'BS',
          amount: 1910,
          amountBs: 1910,
          amountUsd: 0,
          amountEur: 0,
          projectId: project.id,
          userId: user.id,
          paymentStatus: 'PENDING',
          amountPaid: 0,
          entries: {
            create: [
              {
                debitAccountId: debitAccount.id,
                debitAmount: 1910,
                creditAccountId: creditAccount.id,
                creditAmount: 1910,
                description: 'Test expense entry'
              }
            ]
          }
        }
      });
      console.log(`✓ Created test transaction: ${transaction.code}`);
    } else {
      console.log(`✓ Found pending transaction: ${transaction.code} (${transaction.currency} ${transaction.amount})`);
    }

    // 4. Login to get a valid JWT token
    const backendUrl = 'http://localhost:4002';
    console.log(`\n=== Logging in to ${backendUrl}/api/auth/login ===`);
    
    const loginResponse = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: 'admin123' // Default password, adjust if different
      })
    });

    if (!loginResponse.ok) {
      console.log('❌ Login failed. Cannot proceed without valid token.');
      const loginError = await loginResponse.json();
      console.log(JSON.stringify(loginError, null, 2));
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.data.token;
    console.log(`✓ Login successful, got JWT token`);

    // 5. Create payment payload
    const paymentPayload = {
      projectId: project.code, // Using project.code to test resolution
      date: new Date().toISOString(),
      currency: transaction.currency,
      amount: 1910,
      method: 'CARD',
      reference: 'TEST-REF-001',
      allocations: [
        {
          transactionId: transaction.id,
          amount: 1910
        }
      ]
    };

    console.log('\n=== Payment Payload ===');
    console.log(JSON.stringify(paymentPayload, null, 2));

    // 6. Make POST request to /api/payments
    console.log(`\n=== Making POST request to ${backendUrl}/api/payments ===`);

    const response = await fetch(`${backendUrl}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(paymentPayload)
    });

    const responseData = await response.json();

    console.log(`\n=== Response Status: ${response.status} ===`);
    console.log(JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log('\n✅ Payment created successfully!');
      
      // 7. Verify transaction was updated
      const updatedTransaction = await prisma.transaction.findUnique({
        where: { id: transaction.id },
        select: { code: true, amountPaid: true, paymentStatus: true }
      });
      console.log('\n=== Updated Transaction ===');
      console.log(JSON.stringify(updatedTransaction, null, 2));
    } else {
      console.log('\n❌ Payment creation failed');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testCreatePayment();
