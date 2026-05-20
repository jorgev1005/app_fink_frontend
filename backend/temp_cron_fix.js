const fs = require('fs');

let cron = fs.readFileSync('src/services/cron.service.ts', 'utf8');
cron = cron.replace(/cron\.schedule\(\\'0 6/g, "cron.schedule('0 6");
cron = cron.replace(/\\'America\/Caracas\\'/g, "'America/Caracas'");
cron = cron.replace(/\\'/g, "'");

fs.writeFileSync('src/services/cron.service.ts', cron);
console.log('Fixed cron.service.ts quotes');
