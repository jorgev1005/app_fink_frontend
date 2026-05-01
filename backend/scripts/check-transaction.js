#!/usr/bin/env node
// scripts/check-transaction.js
// Usage:
//   node scripts/check-transaction.js --code TRX-... 
//   node scripts/check-transaction.js --desc "compras de viveres"

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};

  // Support --code <val> and --desc <val>
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--code' && args[i+1]) { out.code = args[++i]; }
    else if (a === '--desc' && args[i+1]) { out.desc = args[++i]; }
    else if ((a === '-h' || a === '--help')) { out.help = true; }
  }

  // Also support positional args passed by npm (e.g. `npm run check-transaction -- TRX-...`)
  // If nothing parsed yet, try to infer from positional arguments
  if (!out.code && !out.desc) {
    const raw = process.argv.slice(2).filter(a => !a.startsWith('--'));
    if (raw.length === 1) {
      const maybe = raw[0];
      if (/^TRX-/i.test(maybe)) out.code = maybe;
      else out.desc = maybe;
    } else if (raw.length > 1) {
      // join multiple positional tokens as a description
      out.desc = raw.join(' ');
    }
  }

  return out;
}

async function main() {
  const opts = parseArgs();
  if (opts.help || (!opts.code && !opts.desc)) {
    console.log('Usage: node scripts/check-transaction.js --code <CODE> | --desc <partial description>');
    process.exit(0);
  }

  try {
    if (opts.code) {
      const txn = await prisma.transaction.findUnique({
        where: { code: opts.code },
        include: {
          project: true,
          user: true,
          contactPerson: true,
          exchangeRate: true,
          entries: { include: { debitAccount: true, creditAccount: true } },
          categoryRef: true,
        },
      });
      if (!txn) {
        console.error('No transaction found with code', opts.code);
        process.exit(2);
      }
      // Fetch payment allocations linked to this transaction (with payment info)
      let allocations = [];
      try {
        allocations = await prisma.$queryRaw`
          SELECT pa.*, p.*
          FROM "payment_allocations" pa
          JOIN "payments" p ON p.id = pa."paymentId"
          WHERE pa."transactionId" = ${txn.id}
        `;
      } catch (e) {
        // If the DB doesn't have the transactionId column yet, return empty allocations
        const errStr = String(e || '');
        if (((e && e.code) === '42703') || errStr.includes('transactionId') || errStr.includes('does not exist')) {
          allocations = [];
        } else {
          throw e;
        }
      }

      const computedAmountPaid = (allocations || []).reduce((s, a) => s + parseFloat(a.allocatedAmount || 0), 0).toFixed(2);

      const out = Object.assign({}, txn, {
        allocations,
        computedAmountPaid: computedAmountPaid.toString(),
      });

      console.log(JSON.stringify(out, null, 2));
      process.exit(0);
    }

    if (opts.desc) {
      const rows = await prisma.transaction.findMany({
        where: { description: { contains: opts.desc, mode: 'insensitive' } },
        include: { project: true, user: true, contactPerson: true, exchangeRate: true, entries: { include: { debitAccount: true, creditAccount: true } }, categoryRef: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      if (!rows || rows.length === 0) {
        console.error('No transactions found matching description:', opts.desc);
        process.exit(2);
      }
      // For each transaction, attach allocations and computedAmountPaid
      const enhanced = [];
      for (const tx of rows) {
        let allocations = [];
        try {
          allocations = await prisma.$queryRaw`
            SELECT pa.*, p.*
            FROM "payment_allocations" pa
            JOIN "payments" p ON p.id = pa."paymentId"
            WHERE pa."transactionId" = ${tx.id}
          `;
        } catch (e) {
          const errStr = String(e || '');
          if (((e && e.code) === '42703') || errStr.includes('transactionId') || errStr.includes('does not exist')) allocations = [];
          else throw e;
        }
        const computedAmountPaid = (allocations || []).reduce((s, a) => s + parseFloat(a.allocatedAmount || 0), 0).toFixed(2);
        enhanced.push(Object.assign({}, tx, { allocations, computedAmountPaid: computedAmountPaid.toString() }));
      }
      console.log(JSON.stringify(enhanced, null, 2));
      process.exit(0);
    }
  } catch (err) {
    console.error('Error querying transactions:', err.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
