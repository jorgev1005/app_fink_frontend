const XLSX = require('xlsx');
const wb = XLSX.readFile('test_real_xlsx.xlsx', {raw: true}); // test read raw: true
console.log(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1, raw: true}));
