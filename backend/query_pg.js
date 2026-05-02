const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://grupoal1_finkuser:H3,z,gsjh7VxdVd_@localhost:5432/grupoal1_finkdb?schema=public'
});

client.connect()
  .then(() => {
    return client.query('SELECT name, currency, "balanceBs", "balanceUsd", "isActive" FROM "Account" WHERE "balanceBs" != 0 OR "balanceUsd" != 0');
  })
  .then(res => {
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  })
  .catch(e => {
    console.error('Connection failed:', e.message);
    process.exit(1);
  });
