const fs = require('fs');
let service = fs.readFileSync('src/services/loan.service.ts', 'utf8');

service = service.replace(
  "startDate: startDate ? new Date(startDate) : new Date(),",
  "startDate: startDate ? new Date(startDate) : new Date(),\n      nextChargeDate: calculateNextChargeDate(startDate ? new Date(startDate) : new Date(), interestFrequency || 'WEEKLY'),"
)

fs.writeFileSync('src/services/loan.service.ts', service);
console.log('Fixed nextChargeDate creation');
