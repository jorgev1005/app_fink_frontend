const { Client } = require('pg');

const connectionString = 'postgresql://grupoal1_finkuser:H3,z,gsjh7VxdVd_@localhost:5432/grupoal1_finkdb';

const client = new Client({
  user: 'grupoal1_finkuser',
  host: 'localhost',
  database: 'grupoal1_finkdb',
  password: 'H3,z,gsjh7VxdVd_',
  port: 5432,
});

async function main() {
  try {
    await client.connect();
    console.log('Connected successfully with pg!');
    const res = await client.query('SELECT * FROM accounts WHERE "balanceUsd" = 100');
    console.log('Accounts with $100 balance:');
    res.rows.forEach(r => {
        console.log(`${r.code} - ${r.name}: ${r.balanceUsd} (Active: ${r.isActive})`);
    });
    
    // Fix it?
    // await client.query('UPDATE accounts SET "isActive" = false WHERE ...');
    
    await client.end();
  } catch (err) {
    console.error('Connection error', err.stack);
  }
}

main();
