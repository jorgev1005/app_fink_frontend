const fs = require('fs');
const filepath = 'backend/src/services/telegram.service.ts';
let content = fs.readFileSync(filepath, 'utf8');

const oldEntriesLogic = `      if (theType === 'TRANSFER') {
        if (extractedData.cuenta_destino_id) {
          entriesToCreate.push({
            debitAccountId: extractedData.cuenta_destino_id,
            debitAmount: parsedAmount
          });
        }
        if (extractedData.cuenta_origen_id) {
          entriesToCreate.push({
            creditAccountId: extractedData.cuenta_origen_id,
            creditAmount: parsedAmount
          });
        }
      } else if (theType === 'EXPENSE') {
        if (extractedData.cuenta_origen_id) {
          entriesToCreate.push({
            creditAccountId: extractedData.cuenta_origen_id,
            creditAmount: parsedAmount
          });
        }
      } else if (theType === 'INCOME') {
        if (extractedData.cuenta_destino_id) {
          entriesToCreate.push({
            debitAccountId: extractedData.cuenta_destino_id,
            debitAmount: parsedAmount
          });
        }
      }`;

const newEntriesLogic = `      // Validar los IDs de cuenta para evitar errores de Foreign Key
      const validOrigen = (extractedData.cuenta_origen_id && activeAccounts.find((a) => a.id === extractedData.cuenta_origen_id)) ? extractedData.cuenta_origen_id : null;
      const validDestino = (extractedData.cuenta_destino_id && activeAccounts.find((a) => a.id === extractedData.cuenta_destino_id)) ? extractedData.cuenta_destino_id : null;

      if (theType === 'TRANSFER') {
        if (validDestino) {
          entriesToCreate.push({
            debitAccountId: validDestino,
            debitAmount: parsedAmount
          });
        }
        if (validOrigen) {
          entriesToCreate.push({
            creditAccountId: validOrigen,
            creditAmount: parsedAmount
          });
        }
      } else if (theType === 'EXPENSE') {
        if (validOrigen) {
          entriesToCreate.push({
            creditAccountId: validOrigen,
            creditAmount: parsedAmount
          });
        }
      } else if (theType === 'INCOME') {
        if (validDestino) {
          entriesToCreate.push({
            debitAccountId: validDestino,
            debitAmount: parsedAmount
          });
        }
      }`;

if (content.includes(oldEntriesLogic)) {
    content = content.replace(oldEntriesLogic, newEntriesLogic);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log("Patched IDs validation logic!");
} else {
    console.log("Segment not found... check manually.");
}
