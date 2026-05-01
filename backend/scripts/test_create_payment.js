const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const prisma = new PrismaClient();

async function main() {
  // find any user
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found in DB. Please create a user first.');
    process.exit(1);
  }

  // find any project
  const project = await prisma.project.findFirst();
  if (!project) {
    console.error('No project found in DB. Please create a project first.');
    process.exit(1);
  }

  // create a simple transaction row for allocation (no entries)
  const code = `TRX-TEST-${Date.now()}`;
  const txn = await prisma.transaction.create({
    data: {
      code,
      date: new Date(),
      type: 'EXPENSE',
      status: 'COMPLETED',
      description: 'Test transaction for payment allocation',
      project: { connect: { id: project.id } },
      currency: 'USD',
      amount: 100,
      amountBs: 0,
      amountUsd: 100,
      amountEur: 0,
      user: { connect: { id: user.id } },
      amountPaid: 0,
      paymentStatus: 'PENDING'
    }
  });

  console.log('Created test transaction', txn.id, txn.code);

  // sign JWT for user
  const secret = process.env.JWT_SECRET || 'fink_secret_key_2025_muy_segura_cambiar_en_produccion';
  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, secret, { expiresIn: '1h' });

  const payload = {
    projectId: project.id,
    date: new Date().toISOString(),
    currency: 'USD',
    amount: 100,
    method: 'BANK_TRANSFER',
    reference: `TEST-PAY-${Date.now()}`,
    allocations: [ { transactionId: txn.id, amount: 100 } ]
  };

  console.log('Posting payment to API...', payload);

  const tryPost = async (host) => {
    return fetch(`${host}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  };

  let res;
  try {
    res = await tryPost('http://localhost:4001');
  } catch (e1) {
    console.warn('Failed to post to 4001, trying 4002', e1.message);
    try {
      res = await tryPost('http://localhost:4002');
    } catch (e2) {
      console.error('Failed to post to both ports', e2.message);
      throw e2;
    }
  }

  const body = await res.text();
  console.log('Response status:', res.status);
  console.log('Response body:', body);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
