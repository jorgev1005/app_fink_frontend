const fs = require('fs');
const file = 'D:/Documentos/espacio_vc/app_fink/backend/src/services/loan.service.ts';
let content = fs.readFileSync(file, 'utf8');

const newCode = \xport const deleteLoan = async (loanId: string) => {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw new Error('Préstamo no encontrado');

  const disbursementTx = await prisma.transaction.findFirst({
    where: {
      projectId: loan.projectId,
      type: 'INCOME',
      description: \\\Desembolso de Préstamo a favor: \\\\\\
    }
  });

  await prisma.(async (tx) => {
    if (disbursementTx) {
      await tx.transaction.delete({ where: { id: disbursementTx.id } });
    }
    await tx.loan.delete({ where: { id: loanId } });
    if (loan.linkedAccountId) {
      await tx.account.delete({ where: { id: loan.linkedAccountId } });
    }
  });

  return { success: true };
};

export const getLoansByProject\;

content = content.replace('export const getLoansByProject', newCode);
fs.writeFileSync(file, content);
console.log('loan.service.ts updated');
