const XLSX = require('xlsx'); 
const bstr = 'Fecha,Referencia,Descripción,Monto,Balance\n02/03/2026,5921037454,COMPRA,-1.617,101.52721\n'; 
const wb = XLSX.read(bstr, {type: 'binary', raw: true}); 
console.log(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1, raw: true}));
