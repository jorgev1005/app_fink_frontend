// scripts/run-migration.js
// Usage: node scripts/run-migration.js
// Reads DATABASE_URL from process.env (use .env in backend/ or set env var) and executes the SQL migration file.

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function run() {
  const sqlPath = path.join(__dirname, '..', 'prisma', 'migrations', '20251127_create_transaction_sequences', 'migration.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Migration file not found:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set. Please set it in backend/.env or as an environment variable.');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('Connected to database, beginning migration...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration executed successfully.');

    // List created/available sequences for verification
    try {
      const res = await client.query("SELECT sequence_name FROM information_schema.sequences WHERE sequence_name LIKE 'transaction_code_seq_%' ORDER BY sequence_name");
      const seqs = res.rows.map(r => r.sequence_name);
      if (seqs.length > 0) {
        console.log('Found transaction code sequences:');
        for (const s of seqs) console.log('  -', s);
      } else {
        console.log('No transaction code sequences found matching prefix.');
      }
    } catch (err) {
      console.warn('Could not list sequences:', err.message || err);
    }
  } catch (err) {
    console.error('Migration failed, rolling back. Error:', err.message || err);
    try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error('Unhandled error while running migration:', err);
  process.exit(1);
});
