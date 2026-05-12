const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://grupoal1_finkuser:H3,z,gsjh7VxdVd_@localhost:5432/grupoal1_finkdb?schema=public'
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT * FROM "Transaction" 
    WHERE reference LIKE '%BOT%' OR description ILIKE '%USDT%' OR notes ILIKE '%BOT%'
    ORDER BY date DESC LIMIT 10
  `);
  console.log(JSON.stringify(res.rows, null, 2));

  // let's also fetch projects to know their IDs
  const projects = await client.query(`SELECT id, name FROM "Project"`);
  console.log('\nProjects:', projects.rows);
  
  process.exit(0);
}
main().catch(e => console.error(e));