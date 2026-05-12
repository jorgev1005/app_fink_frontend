"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const database_1 = __importDefault(require("../config/database"));
exports.PaymentService = {
    async createPayment(input) {
        const { projectId, userId, date, amount, currency, accountId, method, reference, allocations, exchangeRate } = input;
        const sourceAccount = await database_1.default.account.findUnique({ where: { id: accountId } });
        if (!sourceAccount)
            throw new Error('Source account not found');
        if (allocations.length === 0)
            throw new Error('Allocations required');
        const firstAlloc = allocations[0];
        let targetType = 'INVOICE';
        let direction = 'EXPENSE';
        let targetObj = null;
        if (firstAlloc.invoiceId) {
            targetObj = await database_1.default.invoice.findUnique({ where: { id: firstAlloc.invoiceId } });
            if (!targetObj)
                throw new Error('Target invoice not found');
            direction = targetObj.type === 'BILL' ? 'EXPENSE' : 'INCOME';
            targetType = 'INVOICE';
        }
        else if (firstAlloc.transactionId) {
            targetObj = await database_1.default.transaction.findUnique({ where: { id: firstAlloc.transactionId } });
            if (!targetObj)
                throw new Error('Target transaction not found');
            direction = targetObj.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
            targetType = 'TRANSACTION';
        }
        else {
            throw new Error('Allocation must have invoiceId or transactionId');
        }
        return await database_1.default.$transaction(async (tx) => {
            const uniqueSuffix = Date.now().toString().slice(-6);
            const paymentCode = `PAY-${projectId.slice(0, 4)}-${uniqueSuffix}`;
            const payment = await tx.payment.create({
                data: {
                    project: { connect: { id: projectId } },
                    code: paymentCode,
                    date,
                    currency,
                    amount,
                    exchangeRate: exchangeRate || 1,
                    method,
                    reference,
                    status: 'COMPLETED',
                    user: { connect: { id: userId } },
                    account: { connect: { id: accountId } },
                    allocations: {
                        create: allocations.map(a => ({
                            invoice: a.invoiceId ? { connect: { id: a.invoiceId } } : undefined,
                            transaction: a.transactionId ? { connect: { id: a.transactionId } } : undefined,
                            allocatedAmount: a.amount
                        }))
                    }
                }
            });
            const transactionCode = `TRX-PAY-${uniqueSuffix}`;
            const effectiveRate = exchangeRate || 1;
            let amountBs = 0;
            let amountUsd = 0;
            if (currency === 'BS') {
                amountBs = amount;
                amountUsd = effectiveRate > 0 ? amount / effectiveRate : 0;
            }
            else if (currency === 'USD') {
                amountUsd = amount;
                amountBs = amount * effectiveRate;
            }
            const description = `Payment for ${targetObj.code} - ${reference || ''}`;
            const isExpense = direction === 'EXPENSE';
            const entries = [];
            entries.push({
                debitAccountId: isExpense ? undefined : accountId,
                creditAccountId: isExpense ? accountId : undefined,
                debitAmount: isExpense ? 0 : amount,
                creditAmount: isExpense ? amount : 0,
                description: `Bank Movement (${currency})`
            });
            const transaction = await tx.transaction.create({
                data: {
                    code: transactionCode,
                    projectId,
                    userId,
                    date,
                    type: isExpense ? 'PAYMENT' : 'COLLECTION',
                    description,
                    reference,
                    currency,
                    amount,
                    amountBs,
                    amountUsd,
                    amountEur: 0,
                    status: 'COMPLETED',
                    paymentRecord: { connect: { id: payment.id } },
                    entries: { create: entries },
                    tags: JSON.stringify(["PAYMENT", "AUTO"]),
                    attachments: '[]'
                }
            });
            for (const entry of entries) {
                if (entry.debitAccountId) {
                    const updateData = {};
                    if (currency === 'BS')
                        updateData.balanceBs = { increment: amount };
                    else if (currency === 'USD')
                        updateData.balanceUsd = { increment: amount };
                    else if (currency === 'EUR')
                        updateData.balanceEur = { increment: amount };
                    await tx.account.update({ where: { id: entry.debitAccountId }, data: updateData });
                }
                if (entry.creditAccountId) {
                    const updateData = {};
                    if (currency === 'BS')
                        updateData.balanceBs = { increment: -amount };
                    else if (currency === 'USD')
                        updateData.balanceUsd = { increment: -amount };
                    else if (currency === 'EUR')
                        updateData.balanceEur = { increment: -amount };
                    await tx.account.update({ where: { id: entry.creditAccountId }, data: updateData });
                }
            }
            if (targetType === 'INVOICE') {
                const inv = targetObj;
                let deduction = amount;
                if (inv.currency !== currency && effectiveRate) {
                    if (inv.currency === 'USD' && currency === 'BS')
                        deduction = amount / effectiveRate;
                    else if (inv.currency === 'BS' && currency === 'USD')
                        deduction = amount * effectiveRate;
                }
                const newOutstanding = Math.max(0, Number(inv.outstanding || inv.total) - deduction);
                const newStatus = newOutstanding < 0.01 ? 'PAID' : 'PARTIALLY_PAID';
                await tx.invoice.update({
                    where: { id: inv.id },
                    data: {
                        status: newStatus,
                        outstanding: newOutstanding
                    }
                });
            }
            else {
                const txn = targetObj;
                let addedPaid = amount;
                if (txn.currency !== currency && effectiveRate) {
                    if (txn.currency === 'USD' && currency === 'BS')
                        addedPaid = amount / effectiveRate;
                    else if (txn.currency === 'BS' && currency === 'USD')
                        addedPaid = amount * effectiveRate;
                }
                const txnAmount = Number(txn.amount || 0);
                const currentPaid = Number(txn.amountPaid || 0) + addedPaid;
                const normalizedPaid = Math.min(txnAmount, currentPaid);
                const epsilon = 0.01;
                let nextPaymentStatus = 'PENDING';
                let nextStatus = 'PENDING';
                if (normalizedPaid >= txnAmount - epsilon) {
                    nextPaymentStatus = 'PAID';
                    nextStatus = 'COMPLETED';
                }
                else if (normalizedPaid > epsilon) {
                    nextPaymentStatus = 'PARTIAL';
                }
                await tx.transaction.update({
                    where: { id: txn.id },
                    data: {
                        amountPaid: normalizedPaid,
                        paymentStatus: nextPaymentStatus,
                        status: nextStatus
                    }
                });
            }
            return payment;
        });
    }
};
//# sourceMappingURL=payment.service.js.map