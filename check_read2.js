const XLSX = require('xlsx');
const bstr = 'Fecha\tMonto\n2026-03-02\t-1.617,00\n';
const wb = XLSX.read(bstr, {type: 'binary', raw: true});
console.log(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1, raw: true}));
