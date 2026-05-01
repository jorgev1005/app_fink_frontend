import prisma from '../config/database';

/**
 * Actualiza el balance de una cuenta en la moneda indicada.
 * operation: 'DEBIT' incrementa para cuentas de naturaleza deudora; 'CREDIT' decrementa (se interpreta por el caller)
 */
export const updateAccountBalance = async (
  accountId: string,
  currency: 'BS' | 'USD' | 'EUR',
  amount: number,
  operation: 'DEBIT' | 'CREDIT'
) => {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return;

  const increment = operation === 'DEBIT' ? amount : -amount;

  const updateData: any = {};
  if (currency === 'BS') updateData.balanceBs = { increment };
  else if (currency === 'USD') updateData.balanceUsd = { increment };
  else if (currency === 'EUR') updateData.balanceEur = { increment };

  await prisma.account.update({ where: { id: accountId }, data: updateData });
};

export default { updateAccountBalance };
