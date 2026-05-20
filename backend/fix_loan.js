const fs = require('fs');

let service = fs.readFileSync('src/services/loan.service.ts', 'utf8');
service = service.replace(/\\\`/g, '\`');
service = service.replace(/\\\$/g, '\$');

fs.writeFileSync('src/services/loan.service.ts', service);
console.log('Fixed backticks in loan.service.ts');
