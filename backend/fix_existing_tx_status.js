const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://grupoal1_finkuser:H3,z,gsjh7VxdVd_@localhost:5432/grupoal1_finkdb?schema=public'
});

async function main() {
  await client.connect();
  console.log("Connected to PostgreSQL on VPS!");

  try {
    await client.query('BEGIN');

    // Fetch all invoices
    const invRes = await client.query('SELECT * FROM "invoices"');
    console.log(`Processing ${invRes.rows.length} invoices...`);

    let updatedCount = 0;

    for (const inv of invRes.rows) {
      // Find the posting transaction for this invoice
      const txType = inv.type === 'BILL' ? 'EXPENSE' : 'INCOME';
      const txRes = await client.query(
        'SELECT * FROM "transactions" WHERE "projectId" = $1 AND "reference" = $2 AND "type" = $3',
        [inv.projectId, inv.code, txType]
      );

      if (txRes.rows.length > 0) {
        const txn = txRes.rows[0];
        
        // Calculate correct values
        const correctAmountPaid = Number(inv.total) - Number(inv.outstanding);
        let correctPaymentStatus = 'PENDING';
        if (inv.status === 'PAID') {
          correctPaymentStatus = 'PAID';
        } else if (correctAmountPaid > 0) {
          correctPaymentStatus = 'PARTIAL';
        }

        // Check if transaction needs update
        if (Number(txn.amountPaid) !== correctAmountPaid || txn.paymentStatus !== correctPaymentStatus) {
          console.log(`Updating Transaction ${txn.code} (Ref: ${inv.code}):`);
          console.log(`  Amount Paid: ${txn.amountPaid} -> ${correctAmountPaid}`);
          console.log(`  Payment Status: ${txn.paymentStatus} -> ${correctPaymentStatus}`);

          await client.query(
            'UPDATE "transactions" SET "amountPaid" = $1, "paymentStatus" = $2 WHERE id = $3',
            [correctAmountPaid, correctPaymentStatus, txn.id]
          );
          updatedCount++;
        }
      }
    }

    await client.query('COMMIT');
    console.log(`Successfully updated ${updatedCount} transactions!`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Failed to fix transactions:", error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
