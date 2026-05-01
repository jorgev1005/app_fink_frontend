const XLSX = require('xlsx');
const fs = require('fs');
fs.writeFileSync('test.csv', 'Monto,Balance\n"1.617,00","100.00"');
const wb = XLSX.read(fs.readFileSync('test.csv', 'binary'), { type: 'binary', raw: true });
console.log(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: true }));
