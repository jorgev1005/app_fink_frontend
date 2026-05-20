const fs = require('fs');

let service = fs.readFileSync('src/services/loan.service.ts', 'utf8');

const additionalCode = `
export const calculateNextChargeDate = (currentDate: Date, frequency: string): Date => {
  const nextDate = new Date(currentDate);
  switch (frequency) {
    case 'DAILY':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'WEEKLY':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'BIWEEKLY':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'MONTHLY':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    default:
      nextDate.setMonth(nextDate.getMonth() + 1);
  }
  return nextDate;
};

// Se debe importar este metodo y meterlo en el cron de cada dia (por ej. cron diario)
export const processLoanInterests = async () => {
  console.log('🔄 Init processing loan interests...');
  const now = new Date();
  
  const dueLoans = await prisma.loan.findMany({
    where: {
      status: 'ACTIVE',
      nextChargeDate: {
        lte: now
      }
    }
  });

  for (const loan of dueLoans) {
    try {
      // Calculate interest amount: remainingCapital * (interestRate / 100)
      const interestAmount = Number(loan.remainingCapital) * (Number(loan.interestRate) / 100);

      if (interestAmount > 0) {
        // Generar cargo
        await prisma.loanCharge.create({
          data: {
            loanId: loan.id,
            amount: interestAmount,
            description: \`Interés automático (\${loan.interestFrequency}) - Saldo: \${loan.remainingCapital}\`,
            date: new Date()
          }
        });
      }

      // Update next charge date
      const nextDate = calculateNextChargeDate(loan.nextChargeDate || new Date(), loan.interestFrequency);
      
      await prisma.loan.update({
        where: { id: loan.id },
        data: {
          nextChargeDate: nextDate
        }
      });
      console.log(\`✅ Generated interest for loan \${loan.id}. Next charge: \${nextDate}\`);
      
    } catch (e) {
      console.error(\`❌ Error generating interest for \${loan.id}:\`, e);
    }
  }
};
`;

// Insert calculateNextChargeDate into createLoan
service = service.replace(
  "interestFrequency: interestFrequency || 'WEEKLY',",
  "interestFrequency: interestFrequency || 'WEEKLY',\n      nextChargeDate: interestFrequency ? undefined : undefined, // Will replace below"
);

// Instead of string replacement, I'll just append it and fix the service logic for nextChargeDate.
fs.writeFileSync('src/services/loan.service.ts', service + "\\n" + additionalCode);
console.log('Added cron logic');
