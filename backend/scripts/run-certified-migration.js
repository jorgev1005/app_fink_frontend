const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function run() {
  const sqlPath = path.join(__dirname, '..', 'prisma', 'migrations', '20260920_add_certified_deliveries', 'migration.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Migration file not found:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set in .env');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('Connected to database, executing certified deliveries migration...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration executed successfully: certified_deliveries and certified_audit_logs created.');
  } catch (err) {
    console.error('Migration error:', err.message || err);
    try { await client.query('ROLLBACK'); } catch (e) {}
  } finally {
    await client.end();
  }
}

run();
