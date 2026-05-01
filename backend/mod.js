const fs = require('fs');
const path = 'D:\\Documentos\\espacio_vc\\app_fink\\backend\\src\\services\\telegram.service.ts';
let code = fs.readFileSync(path, 'utf-8');

code = code.replace(
    'select: { id: true, name: true, projectId: true }', 
    'select: { id: true, name: true, projectId: true, currency: true }'
);

const searchStr = `
      let parsedAmount = Number(extractedData.monto) || 0;
      let finalCurrency = 'BS'; 
      if (extractedData.moneda_final === 'USD' || extractedData.moneda_final === 'EUR') {
        finalCurrency = extractedData.moneda_final;
      } else if (!extractedData.moneda_final && (extractedData.moneda_dictada === 'USD' || extractedData.moneda_dictada === 'EUR')) {
        finalCurrency = extractedData.moneda_dictada;
      }

      const rawType = extractedData.tipo || '';
      let theType = 'EXPENSE';
      if (rawType.toLowerCase() === 'ingreso') theType = 'INCOME';
      if (rawType.toLowerCase() === 'transferencia') theType = 'TRANSFER';
`;

const replaceStr = searchStr + `
      const originAcc = extractedData.cuenta_origen_id ? activeAccounts.find((a:any) => a.id === extractedData.cuenta_origen_id) : null;
      const destAcc = extractedData.cuenta_destino_id ? activeAccounts.find((a:any) => a.id === extractedData.cuenta_destino_id) : null;
      
      if (theType === 'TRANSFER' && originAcc && destAcc && originAcc.currency === destAcc.currency) {
           finalCurrency = originAcc.currency;
      } else if (theType === 'EXPENSE' && originAcc && originAcc.currency) {
           finalCurrency = originAcc.currency;
      } else if (theType === 'INCOME' && destAcc && destAcc.currency) {
           finalCurrency = destAcc.currency;
      }
`;

if (code.includes('if (theType === \'TRANSFER\' && originAcc && destAcc')) {
  console.log('Already modified');
} else {
  code = code.replace(searchStr.trim(), replaceStr.trim());
  fs.writeFileSync(path, code);
  console.log('Modified telegram.service.ts');
}
