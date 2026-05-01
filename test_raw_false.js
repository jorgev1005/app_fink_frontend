const XLSX = require('xlsx');
const fs = require('fs');
const wb = XLSX.readFile('test_real_xlsx.xlsx'); // raw defaults to false? nope, it doesn't apply there.
// sheet_to_json raw: false means format the text!
console.log(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1, raw: false}));
