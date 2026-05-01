const fs = require('fs');
const path = 'D:\\Documentos\\espacio_vc\\app_fink\\backend\\src\\services\\telegram.service.ts';
let code = fs.readFileSync(path, 'utf-8');

// The string to replace in bot.on('callback_query')
const searchStr = `
    if (query.data === 'save_tx') {
      const txData = pendingTransactions.get(chatId);
      if (txData) {
        try {
          const newTx = await prisma.transaction.create({ data: txData });
`;

const replaceStr = `
    if (query.data === 'save_tx') {
      const txData = pendingTransactions.get(chatId);
      if (txData) {
        try {
          // Cambiar a PAID e indicar monto pagado antes de crear
          txData.paymentStatus = 'PAID';
          txData.amountPaid = txData.amount;
          
          const newTx = await prisma.transaction.create({ 
            data: txData,
            include: { entries: true } 
          });

          // Auto-ejecutar el pago de la transaccion
          const payment = await prisma.payment.create({
            data: {
              project: { connect: { id: newTx.projectId } },
              code: "PAY-" + newTx.projectId.substring(0,6) + "-" + Date.now(),
              date: newTx.date,
              currency: newTx.currency,
              amount: newTx.amount,
              method: 'BANK_TRANSFER',
              status: 'COMPLETED',
              user: { connect: { id: newTx.userId } },
            }
          });

          // Conectar pago con transaccion
          await prisma.paymentAllocation.create({
            data: {
              payment: { connect: { id: payment.id } },
              transaction: { connect: { id: newTx.id } },
              allocatedAmount: newTx.amount,
            }
          });

          // Actualizar saldos de los bancos!
          const { updateAccountBalance } = require('./account.service');
          for (const entry of newTx.entries) {
            if (entry.debitAccountId && entry.debitAmount > 0) {
              await updateAccountBalance(entry.debitAccountId, newTx.currency, entry.debitAmount, 'DEBIT');
            }
            if (entry.creditAccountId && entry.creditAmount > 0) {
              await updateAccountBalance(entry.creditAccountId, newTx.currency, entry.creditAmount, 'CREDIT');
            }
          }
`;

if (code.includes('// Auto-ejecutar el pago de la transaccion')) {
  console.log('Already modified');
} else {
  code = code.replace(searchStr.trim(), replaceStr.trim());
  fs.writeFileSync(path, code);
  console.log('Modified telegram.service.ts for payment execution');
}
