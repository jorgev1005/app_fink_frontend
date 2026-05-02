import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import attachmentsService from '../services/attachments.service';
import { getLatestExchangeRate } from '../services/exchangeRate.service';
import { updateAccountBalance } from '../services/account.service';
import resolveProjectId from '../utils/resolveProjectId';
import { checkProjectWriteAccess, getProjectAccessFilter } from '../utils/projectAccess';

const prisma = new PrismaClient();

/**
 * Obtener todas las transacciones (con filtros)
 */
export const getTransactions = async (req: Request, res: Response) => {
  try {
    const { projectId, type, status, paymentStatus, startDate, endDate, search, category, page = 1, limit = 50 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const user = (req as any).user;
    const where: any = {
      ...getProjectAccessFilter(user)
    };

    if (projectId) {
      // Allow seeing transactions that belong to the project OR affect its accounts
      where.OR = [
        { projectId: projectId },
        {
          entries: {
            some: {
              OR: [
                { debitAccount: { projectId: projectId } },
                { creditAccount: { projectId: projectId } }
              ]
            }
          }
        }
      ];
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (paymentStatus) {
      if (paymentStatus === 'OVERDUE') {
        where.paymentStatus = { not: 'PAID' };
        where.dueDate = { lt: new Date() };
      } else if (paymentStatus === 'PENDING') {
        // PENDING should include PENDING status AND not overdue (if we want strict separation)
        // OR just PENDING status.
        // If user selects PENDING, they usually expect things that are not paid.
        // But if we have a separate OVERDUE filter, PENDING should probably exclude overdue?
        // Let's keep it simple: PENDING matches the status PENDING.
        // However, if the DB default is PENDING, we might need to be careful.
        where.paymentStatus = 'PENDING';
      } else {
        where.paymentStatus = paymentStatus;
      }
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    if (search) {
      where.OR = [
        { code: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { reference: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (category) {
      // allow filtering by exact legacy category (case-insensitive)
      where.category = { equals: category as string, mode: 'insensitive' };
    }

    // filter by normalized category id if provided
    if (req.query.categoryId) {
      where.categoryId = req.query.categoryId as string;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          contactPerson: {
            select: {
              id: true,
              name: true,
              type: true,
              email: true,
            },
          },
          entries: {
            include: {
              debitAccount: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
              creditAccount: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
          exchangeRate: true,
          allocations: {
            include: {
              payment: {
                select: {
                  targetCurrency: true,
                  exchangeRate: true,
                }
              }
            }
          },
          // include normalized category reference
          categoryRef: {
            select: {
              id: true,
              name: true,
            }
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.transaction.count({ where }),
    ]);

    const parsedTransactions = transactions.map((t: any) => {
      try {
        return {
          ...t,
          tags: typeof t.tags === 'string' ? JSON.parse(t.tags) : t.tags,
          attachments: typeof t.attachments === 'string' ? JSON.parse(t.attachments) : t.attachments,
          lines: typeof t.lines === 'string' ? JSON.parse(t.lines) : t.lines,
        };
      } catch (e) {
        return t;
      }
    });

    res.json({
      success: true,
      data: parsedTransactions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
      },
    });
  }
};

/**
 * Obtener una transacción por ID
 */
export const getTransactionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        project: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        contactPerson: {
          select: {
            id: true,
            name: true,
            type: true,
            email: true,
            phone: true,
            taxId: true,
          },
        },
        exchangeRate: true,
        entries: {
          include: {
            debitAccount: true,
            creditAccount: true,
          },
        },
        documents: true,
        categoryRef: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Transacción no encontrada',
        },
      });
    }

    const parsedTransaction = {
      ...transaction,
      tags: typeof transaction.tags === 'string' ? JSON.parse(transaction.tags) : transaction.tags,
      attachments: typeof transaction.attachments === 'string' ? JSON.parse(transaction.attachments) : transaction.attachments,
      lines: typeof transaction.lines === 'string' ? JSON.parse(transaction.lines) : transaction.lines,
    };

    res.json({
      success: true,
      data: parsedTransaction,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
      },
    });
  }
};

/**
 * Subir archivos (attachments) para una transacción
 * Endpoint: POST /api/transactions/:id/attachments
 * Se espera multipart/form-data con campos 'files' (multiple)
 */
export const uploadTransactionAttachments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const files = (req.files || []) as Express.Multer.File[];
    if (files.length === 0) return res.status(400).json({ success: false, error: { message: 'No se recibieron archivos' } });

    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: { message: 'No autenticado' } });

    const result = await attachmentsService.processAttachments(id, files, user.id);
    res.json({ success: true, data: result.transaction, uploaded: result.uploaded, ai: result.ai });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

/**
 * Eliminar un attachment de una transacción
 * Endpoint: DELETE /api/transactions/:id/attachments?filename=<filename> (el nombre del archivo, no la url)
 */
export const deleteTransactionAttachment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const filename = req.query.filename as string;
    if (!filename) {
      return res.status(400).json({ success: false, error: { message: 'Se requiere query param filename' } });
    }

    const transaction = await prisma.transaction.findUnique({ where: { id } });
    if (!transaction) return res.status(404).json({ success: false, error: { message: 'Transacción no encontrada' } });

    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: { message: 'No autenticado' } });
    const isAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
    if (!isAdmin) {
      if (!user.id) {
        console.error('[transaction.controller] user.id missing:', user);
        return res.status(401).json({ success: false, error: { message: 'No autenticado (user.id missing)' } });
      }
      const membership = await prisma.projectUser.findUnique({ where: { projectId_userId: { projectId: transaction.projectId, userId: user.id } } });
      if (!membership) return res.status(403).json({ success: false, error: { message: 'No autorizado para eliminar archivos de esta transacción' } });
    }

    const updatedTxn = await attachmentsService.deleteAttachmentInternal(id, filename);
    res.json({ success: true, data: updatedTxn });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

/**
 * Crear una nueva transacción
 */
export const createTransaction = async (req: Request, res: Response) => {
    // Validar que ninguna cuenta involucrada esté desactivada
    const { entries } = req.body;
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        if (entry.debitAccountId) {
          const debitAcc = await prisma.account.findUnique({ where: { id: entry.debitAccountId } });
          if (debitAcc && debitAcc.isActive === false) {
            return res.status(400).json({ success: false, error: { message: `No se puede usar la cuenta desactivada: ${debitAcc.code} - ${debitAcc.name}` } });
          }
        }
        if (entry.creditAccountId) {
          const creditAcc = await prisma.account.findUnique({ where: { id: entry.creditAccountId } });
          if (creditAcc && creditAcc.isActive === false) {
            return res.status(400).json({ success: false, error: { message: `No se puede usar la cuenta desactivada: ${creditAcc.code} - ${creditAcc.name}` } });
          }
        }
      }
    }
  try {
    const {
      projectId,
      type,
      description,
      reference,
      notes,
      date,
      currency,
      amount,
      entries,
      category,
      categoryId,
      subcategory,
      tags,
      exchangeRateId,
      contactPersonId,
      attachments,
      lines, // New field for product details
      // QuickTransaction option: create as pending (true) or create and mark paid (false)
      createAsPending,
      // optional payment info when creating as paid atomically
      paymentMethod,
      paymentReference,
    } = req.body;

    const user = (req as any).user;

    // Validate projectId is provided
    if (!projectId) {
      return res.status(400).json({ success: false, error: { message: 'Se requiere projectId para crear la transacción' } });
    }

    // Resolve projectId: accept either project UUID or project.code
    const resolvedProjectId = await resolveProjectId(projectId as any);

    // If resolution failed, return an error (avoid passing null into Prisma where filters)
    if (!resolvedProjectId) {
      return res.status(404).json({ success: false, error: { message: 'Proyecto no encontrado' } });
    }

    // Check write access
    const hasAccess = await checkProjectWriteAccess(user, resolvedProjectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para crear transacciones en este proyecto' } });
    }

    // Validate Contact for Income/Expense
    if ((type === 'INCOME' || type === 'EXPENSE') && !contactPersonId) {
        return res.status(400).json({ success: false, error: { message: 'El contacto (cliente/proveedor) es obligatorio para ingresos y gastos' } });
    }

    // Generar código único de transacción
    const project = await prisma.project.findUnique({
      where: { id: resolvedProjectId },
      select: { code: true },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Proyecto no encontrado',
        },
      });
    }

    // [Fix for Pending Transactions affecting Bank Balance]
    // If creating as pending, ensure we don't credit a Bank/Cash account directly.
    // Instead, swap to an Accounts Payable (Liability) account.
    if (createAsPending && Array.isArray(entries)) {
      const creditAccountIds = entries
        .filter((e: any) => e.creditAccountId)
        .map((e: any) => e.creditAccountId);
      
      if (creditAccountIds.length > 0) {
        // Check if any of these are Liquid Assets (Bank/Cash)
        const liquidAssets = await prisma.account.findMany({
          where: {
            id: { in: creditAccountIds },
            type: 'ASSET',
            subType: { in: ['BANK', 'CASH'] }
          },
          select: { id: true }
        });

        if (liquidAssets.length > 0) {
          const liquidIds = new Set(liquidAssets.map(a => a.id));
          
          // Find a suitable Accounts Payable account
          const apAccount = await prisma.account.findFirst({
            where: {
              projectId: resolvedProjectId,
              type: 'LIABILITY',
              OR: [
                { subType: 'PAYABLE' },
                { name: { contains: 'Pagar' } },
                { code: { startsWith: '2' } }
              ]
            },
            orderBy: { code: 'asc' }
          });

          if (apAccount) {
            // Perform the swap
            entries.forEach((entry: any) => {
              if (entry.creditAccountId && liquidIds.has(entry.creditAccountId)) {
                // console.log(`[createTransaction] Swapping Bank ${entry.creditAccountId} to AP ${apAccount.id} for pending transaction`);
                entry.creditAccountId = apAccount.id;
              }
            });
          } else {
             console.warn('[createTransaction] Pending transaction uses Bank account but no Accounts Payable account found to swap.');
          }
        }
      }
    }

    // Contar transacciones del proyecto para generar código secuencial
    const transactionCount = await prisma.transaction.count({
      where: { projectId: resolvedProjectId },
    });

  const code = `TRX-${project.code}-${String(transactionCount + 1).padStart(4, '0')}`;

    // Validar que las entradas estén presentes y sean un array
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Se requieren entradas (entries) para crear la transacción' },
      });
    }

    // Si es TRANSFER, validar reglas específicas: debe haber una entrada de débito y una de crédito, opcionalmente una comisión
    if (type === 'TRANSFER') {
      // encontrar entradas con debitAccountId y creditAccountId
      const debitEntries = entries.filter((e: any) => e.debitAccountId && Number(e.debitAmount) > 0);
      const creditEntries = entries.filter((e: any) => e.creditAccountId && Number(e.creditAmount) > 0);

      if (debitEntries.length === 0 || creditEntries.length === 0) {
        return res.status(400).json({ success: false, error: { message: 'Transferencia debe incluir al menos una cuenta destino (débito) y una cuenta origen (crédito) con montos' } });
      }

      // Para transferencias, esperamos máximo 2 débitos (destino + comisión) y 1 crédito (origen)
      if (debitEntries.length > 2 || creditEntries.length > 1) {
        return res.status(400).json({ success: false, error: { message: 'Transferencia inválida: máximo 2 débitos (destino + comisión opcional) y 1 crédito (origen)' } });
      }

      // evitar transferencia entre la misma cuenta
      for (const e of entries) {
        if (e.debitAccountId && e.creditAccountId && String(e.debitAccountId) === String(e.creditAccountId)) {
          return res.status(400).json({ success: false, error: { message: 'No se permite transferir entre la misma cuenta' } });
        }
      }

      // Verificar que todas las cuentas involucradas tengan la misma moneda base
      const allTransferAccountIds = [
        ...debitEntries.map((e: any) => e.debitAccountId).filter(Boolean),
        ...creditEntries.map((e: any) => e.creditAccountId).filter(Boolean)
      ];
      const involvedAccounts = await prisma.account.findMany({ where: { id: { in: allTransferAccountIds } } });
      if (involvedAccounts.length > 0) {
        const firstCurrency = involvedAccounts[0].currency;
        const mismatch = involvedAccounts.find(a => a.currency !== firstCurrency);
        if (mismatch) {
          return res.status(400).json({ 
            success: false, 
            error: { message: `No se permite transferir entre cuentas con distinta moneda base. Verifica la configuración de cada cuenta.` } 
          });
        }
      }

      // comprobar saldo disponible en la(s) cuenta(s) origen (credit accounts)
      // Sumamos los montos por cuenta por si hay varias partidas
      const creditSums: Record<string, number> = {};
      for (const e of entries) {
        if (e.creditAccountId && Number(e.creditAmount) > 0) {
          creditSums[e.creditAccountId] = (creditSums[e.creditAccountId] || 0) + Number(e.creditAmount);
        }
      }

      // obtener balances actuales de las cuentas involucradas
      const creditAccountIds = Object.keys(creditSums);
      if (creditAccountIds.length > 0) {
        const accounts = await prisma.account.findMany({ where: { id: { in: creditAccountIds } } });
        const acctMap: Record<string, any> = {};
        for (const a of accounts) acctMap[a.id] = a;

        for (const acctId of creditAccountIds) {
          const required = creditSums[acctId] || 0;
          const acct = acctMap[acctId];
          if (!acct) return res.status(400).json({ success: false, error: { message: `Cuenta origen no encontrada: ${acctId}` } });
          // seleccionar columna según moneda
          let available = 0;
          if (currency === 'BS') available = Number(acct.balanceBs || 0);
          else if (currency === 'USD') available = Number(acct.balanceUsd || 0);
          else if (currency === 'EUR') available = Number(acct.balanceEur || 0);

          if (available + 0.0001 < required) {
            return res.status(400).json({ success: false, error: { message: `Saldo insuficiente en la cuenta origen (${acct.code || acctId}). Disponible: ${available}, requerido: ${required}` } });
          }
        }
      }
    }

    // Validar que las entradas estén balanceadas
    let totalDebits = 0;
    let totalCredits = 0;

    for (const entry of entries) {
      totalDebits += Number(entry.debitAmount || 0);
      totalCredits += Number(entry.creditAmount || 0);
    }

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Las entradas no están balanceadas. Total débitos debe igual total créditos.',
          details: {
            totalDebits,
            totalCredits,
            difference: totalDebits - totalCredits,
          },
        },
      });
    }

    // Obtener tasa de cambio si se especificó (puede venir exchangeRateId o rateSource)
    const rateSource = req.body.rateSource as string | undefined;
    let exchangeRate = null;
    if (exchangeRateId) {
      exchangeRate = await prisma.exchangeRate.findUnique({ where: { id: exchangeRateId } });
    } else if (rateSource) {
      // encuentra la última tasa según la fuente o id (getLatest permite pasar 'BCV'|'BINANCE'|'CUSTOM' o id)
      exchangeRate = await getLatestExchangeRate(rateSource);
    } else {
      // Obtener la última tasa de cambio disponible
      exchangeRate = await prisma.exchangeRate.findFirst({ orderBy: { date: 'desc' } });
    }

    // Calcular montos en todas las monedas
    let amountBs: number | undefined = undefined;
    let amountUsd: number | undefined = undefined;
    let amountEur: number | undefined = undefined;

    const safeNumber = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    if (currency === 'BS') {
      amountBs = safeNumber(amount);
      if (exchangeRate) {
        const usdToBs = safeNumber(exchangeRate.usdToBs);
        const eurToBs = safeNumber(exchangeRate.eurToBs);
        if (usdToBs) amountUsd = safeNumber(amountBs! / usdToBs);
        if (eurToBs) amountEur = safeNumber(amountBs! / eurToBs);
      }
    } else if (currency === 'USD') {
      amountUsd = safeNumber(amount);
      if (exchangeRate) {
        const usdToBs = safeNumber(exchangeRate.usdToBs);
        const eurToUsd = safeNumber(exchangeRate.eurToUsd);
        if (usdToBs) amountBs = safeNumber(amountUsd! * usdToBs);
        // To convert USD -> EUR, divide USD by (USD per EUR) = eurToUsd
        if (eurToUsd) amountEur = safeNumber(amountUsd! / eurToUsd);
      }
    } else if (currency === 'EUR') {
      amountEur = safeNumber(amount);
      if (exchangeRate) {
        const eurToBs = safeNumber(exchangeRate.eurToBs);
        const eurToUsd = safeNumber(exchangeRate.eurToUsd);
        if (eurToBs) amountBs = safeNumber(amountEur! * eurToBs);
        if (eurToUsd) amountUsd = safeNumber(amountEur! / eurToUsd);
      }
    }

    // Parsear fecha correctamente (evitar problemas de zona horaria)
    let transactionDate = new Date();
    if (date) {
      // Si viene en formato YYYY-MM-DD, agregar hora local para evitar conversión UTC
      if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        transactionDate = new Date(date + 'T12:00:00');
      } else {
        transactionDate = new Date(date);
      }
    }

    // Validar que las tasas necesarias existan para calcular montos derivados.
    // Si faltan, rechazamos con 400 para que el frontend muestre un aviso y el usuario lo corrija.
    const missingRates: string[] = [];
    if (!exchangeRate) {
      missingRates.push('exchangeRate (no disponible)');
    }

    if (currency === 'BS') {
      if (!exchangeRate || safeNumber(exchangeRate.usdToBs) === undefined) missingRates.push('usdToBs');
      if (!exchangeRate || safeNumber(exchangeRate.eurToBs) === undefined) missingRates.push('eurToBs');
    } else if (currency === 'USD') {
      if (!exchangeRate || safeNumber(exchangeRate.usdToBs) === undefined) missingRates.push('usdToBs');
      if (!exchangeRate || safeNumber(exchangeRate.eurToUsd) === undefined) missingRates.push('eurToUsd');
    } else if (currency === 'EUR') {
      if (!exchangeRate || safeNumber(exchangeRate.eurToBs) === undefined) missingRates.push('eurToBs');
      if (!exchangeRate || safeNumber(exchangeRate.eurToUsd) === undefined) missingRates.push('eurToUsd');
    }

    if (missingRates.length > 0) {
      const firstMissing = missingRates[0];
      const userMessages: Record<string, string> = {
        'eurToBs': 'No existe la tasa EUR→BS. Contacte al administrador.',
        'usdToBs': 'No existe la tasa USD→BS. Contacte al administrador.',
        'eurToUsd': 'No existe la tasa EUR↔USD. Contacte al administrador.',
        'exchangeRate (no disponible)': 'No hay registro de tasa de cambio. Contacte al administrador.',
      };

      const userMessage = userMessages[firstMissing] ?? 'Faltan tasas de cambio. Contacte al administrador.';

      console.warn('[createTransaction] Missing exchange rates:', missingRates, 'exchangeRateId=', exchangeRate ? exchangeRate.id : null);

      return res.status(400).json({
        success: false,
        error: {
          message: 'Faltan las tasas de cambio necesarias para calcular montos derivados',
          userMessage,
          details: {
            missing: missingRates,
            exchangeRateId: exchangeRate ? exchangeRate.id : null,
          },
        },
      });
    }

    // Preparar entradas y datos comunes (no dependen del código secuencial)
    const categoryConnect = categoryId && String(categoryId).trim() ? { connect: { id: categoryId } } : undefined;
    const contactPersonConnect = contactPersonId && String(contactPersonId).trim() ? { connect: { id: contactPersonId } } : undefined;
    const exchangeRateConnect = exchangeRate && exchangeRate.id ? { connect: { id: exchangeRate.id } } : undefined;

    const entriesCreate = (entries || [])
      .map((entry: any) => {
        const debitAmount = Number(entry.debitAmount || 0);
        const creditAmount = Number(entry.creditAmount || 0);
        const eData: any = {
          debitAmount,
          creditAmount,
        };
        if (entry.description) eData.description = entry.description;
        if (entry.debitAccountId && String(entry.debitAccountId).trim()) eData.debitAccount = { connect: { id: entry.debitAccountId } };
        if (entry.creditAccountId && String(entry.creditAccountId).trim()) eData.creditAccount = { connect: { id: entry.creditAccountId } };
        return eData;
      })
      .filter((e: any) => (e.debitAccount || e.creditAccount) || (e.debitAmount !== 0 || e.creditAmount !== 0));

    // Support optional fees
    const fees = req.body.fees;
    if (Array.isArray(fees) && fees.length > 0) {
      for (const f of fees) {
        const feeAmt = Number(f.amount || 0);
        if (!f.accountId || feeAmt <= 0) continue;
        const feeEntry: any = {
          description: f.description || 'Fee',
          creditAmount: feeAmt,
        };
        feeEntry.creditAccount = { connect: { id: f.accountId } };
        if (f.counterAccountId) {
          feeEntry.debitAmount = feeAmt;
          feeEntry.debitAccount = { connect: { id: f.counterAccountId } };
        }
        entriesCreate.push(feeEntry);
      }
    }

    const baseCreateData: any = {
      type,
      description,
      reference,
      notes,
      date: transactionDate,
      currency,
      amount: Number(amount),
      category,
      categoryRef: categoryConnect,
      subcategory,
      tags: JSON.stringify(tags || []),
      attachments: attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : '[]',
      lines: lines ? (typeof lines === 'string' ? lines : JSON.stringify(lines)) : null,
      status: req.body.status || 'COMPLETED',
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      project: { connect: { id: resolvedProjectId } },
      user: { connect: { id: user.id } },
      contactPerson: contactPersonConnect,
      exchangeRate: exchangeRateConnect,
      entries: { create: entriesCreate },
    };

    // Siempre proveer montos derivados (requerido por el esquema)
    baseCreateData.amountBs = typeof amountBs === 'number' ? amountBs : 0;
    baseCreateData.amountUsd = typeof amountUsd === 'number' ? amountUsd : 0;
    baseCreateData.amountEur = typeof amountEur === 'number' ? amountEur : 0;

    // Implementación simplificada para SQLite (sin secuencias nativas)
    let createdTransactionLocal: any = null;
    const maxRetriesLocal = 5;
    for (let attempt = 1; attempt <= maxRetriesLocal; attempt++) {
      // Generar código único basado en timestamp y random para evitar colisiones en SQLite
      const uniqueSuffix = Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const codeFinal = `TRX-${project.code}-${uniqueSuffix}`;
      const createData = { ...baseCreateData, code: codeFinal };

      try {
        console.debug('[createTransaction] Prepared create data keys:', Object.keys(createData));
        const safeStringify = (obj: any) => JSON.stringify(obj, (_k, v) => (v instanceof Date ? v.toISOString() : v), 2);
        console.debug('[createTransaction] createData preview:', safeStringify({ ...createData, entries: createData.entries && createData.entries.create ? createData.entries.create.map((e: any) => ({ debitAccount: e.debitAccount ? e.debitAccount : undefined, creditAccount: e.creditAccount ? e.creditAccount : undefined, debitAmount: e.debitAmount, creditAmount: e.creditAmount })) : [], }));

        createdTransactionLocal = await prisma.$transaction(async (tx) => {
          const txn = await tx.transaction.create({
            data: createData,
            include: {
              project: true,
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
              contactPerson: { select: { id: true, name: true, type: true, email: true, phone: true, taxId: true } },
              entries: { include: { debitAccount: true, creditAccount: true } },
              categoryRef: { select: { id: true, name: true } },
            },
          });

          // If caller requested to create the transaction as paid (not pending),
          // create a Payment + PaymentAllocation atomically and update transaction amounts/status.
          const makePending = Boolean(createAsPending);
          if (!makePending) {
            try {
              const payCode = `PAY-${resolvedProjectId}-${Date.now()}`;
              const payment = await tx.payment.create({
                data: {
                  project: { connect: { id: resolvedProjectId } },
                  code: payCode,
                  date: transactionDate,
                  currency: txn.currency,
                  amount: Number(txn.amount),
                  method: paymentMethod || 'BANK_TRANSFER',
                  reference: paymentReference || undefined,
                  status: 'COMPLETED',
                  user: { connect: { id: user.id } },
                }
              });

              // create allocation linking payment -> transaction
              await tx.paymentAllocation.create({
                data: {
                  payment: { connect: { id: payment.id } },
                  transaction: { connect: { id: txn.id } },
                  allocatedAmount: Number(txn.amount),
                }
              });

              // update transaction amountPaid and paymentStatus
              await tx.transaction.update({ where: { id: txn.id }, data: { amountPaid: Number(txn.amount), paymentStatus: 'PAID' } });
            } catch (err) {
              console.error('[createTransaction] failed to create payment atomically', err);
              throw err;
            }
          }

          return txn;
        });

        // éxito
        break;
      } catch (err: any) {
        const isUniqueCodeError = err?.code === 'P2002' && err?.meta?.target && (Array.isArray(err.meta.target) ? err.meta.target.includes('code') : String(err.meta.target).includes('code'));
        if (isUniqueCodeError) {
          console.warn(`[createTransaction] unique code collision on attempt ${attempt} (code=${codeFinal}), will retry and consume next sequence value`);
          continue; // next loop will consume another nextval
        }
        console.error('[createTransaction] Prisma create failed', { codeFinal, projectId, createData }, err);
        throw err;
      }
    }

    const transaction = createdTransactionLocal;

    // === LOG DE ACTIVIDAD ===
    try {
      const { logActivity } = await import('../services/activityLog.service');
      await logActivity(
        user.id,
        'CREATE',
        'Transaction',
        transaction.id,
        `Creación de transacción ${transaction.code}`,
        {
          amount: transaction.amount,
          currency: transaction.currency,
          type: transaction.type,
          projectId: transaction.projectId,
          entries: transaction.entries.map((e: any) => ({
            debitAccountId: e.debitAccountId,
            creditAccountId: e.creditAccountId,
            debitAmount: e.debitAmount,
            creditAmount: e.creditAmount
          }))
        },
        req.ip,
        req.headers['user-agent'] as string
      );
    } catch (err) {
      console.error('Error registrando log de actividad (createTransaction):', err);
    }

    // Actualizar balances de las cuentas afectadas sobre la transacción creada
    // Usar los montos ya persistidos en transaction.entries y convertirlos a la moneda de la cuenta si es necesario
    const conv = (amount: number, from: string, to: string) => {
      if (from === to) return amount;
      const usdToBs = exchangeRate ? Number(exchangeRate.usdToBs || 0) : 0;
      const eurToBs = exchangeRate ? Number(exchangeRate.eurToBs || 0) : 0;
      const eurToUsd = exchangeRate ? Number(exchangeRate.eurToUsd || 0) : 0;

      if (from === 'BS' && to === 'USD' && usdToBs) return amount / usdToBs;
      if (from === 'BS' && to === 'EUR' && eurToBs) return amount / eurToBs;
      if (from === 'USD' && to === 'BS' && usdToBs) return amount * usdToBs;
      if (from === 'EUR' && to === 'BS' && eurToBs) return amount * eurToBs;
      if (from === 'USD' && to === 'EUR' && eurToUsd) return amount / eurToUsd;
      if (from === 'EUR' && to === 'USD' && eurToUsd) return amount * eurToUsd;

      // Fallback: no conversion possible, devolver monto original y loguear
      console.warn('[createTransaction] No se pudo convertir monto', { amount, from, to });
      return amount;
    };

    for (const entry of transaction.entries) {
      // debit side: increment balance on debit account
      if (entry.debitAccountId && Number(entry.debitAmount) > 0) {
        const acct = entry.debitAccount as any;
        const acctCurrency = acct && acct.currency ? acct.currency : (currency as any);
        const converted = conv(Number(entry.debitAmount), currency as string, acctCurrency);
        await updateAccountBalance(entry.debitAccountId, acctCurrency, Number(converted), 'DEBIT');
      }

      // credit side: decrement balance on credit account
      if (entry.creditAccountId && Number(entry.creditAmount) > 0) {
        const acct = entry.creditAccount as any;
        const acctCurrency = acct && acct.currency ? acct.currency : (currency as any);
        const converted = conv(Number(entry.creditAmount), currency as string, acctCurrency);
        await updateAccountBalance(entry.creditAccountId, acctCurrency, Number(converted), 'CREDIT');
      }
    }

    res.status(201).json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
      },
    });
  }
};

/**
 * Actualizar una transacción
 */
export const updateTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const existingTx = await prisma.transaction.findUnique({ where: { id } });
    if (!existingTx) {
      return res.status(404).json({ success: false, error: { message: 'Transacción no encontrada' } });
    }

    const hasAccess = await checkProjectWriteAccess(user, existingTx.projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para modificar transacciones en este proyecto' } });
    }

    const { 
      description, 
      reference, 
      notes, 
      category, 
      categoryId,
      subcategory, 
      tags, 
      status,
      contactPersonId,
      type,
      date,
      currency,
      amount,
      exchangeRateId,
      attachments,
      projectId,
    } = req.body;

    let finalProjectId = existingTx.projectId;

    // Si intenta cambiar de proyecto, verificar acceso al nuevo proyecto
    if (projectId && projectId !== existingTx.projectId) {
      const resolvedTarget = await resolveProjectId(projectId as any);
      if (!resolvedTarget) {
        return res.status(404).json({ success: false, error: { message: 'Proyecto destino no encontrado' } });
      }

      const hasNewProjectAccess = await checkProjectWriteAccess(user, resolvedTarget);
      if (!hasNewProjectAccess) {
        return res.status(403).json({ success: false, error: { message: 'No tienes permisos en el proyecto destino' } });
      }
      finalProjectId = resolvedTarget;
    }

    // Preparar datos de actualización asegurando no tener undefined
    const updateData: any = {};

    if (projectId !== undefined) updateData.projectId = finalProjectId;
    if (description !== undefined) updateData.description = description;
    if (reference !== undefined) updateData.reference = reference;
    if (notes !== undefined) updateData.notes = notes;
    if (category !== undefined) updateData.category = category;
    if (subcategory !== undefined) updateData.subcategory = subcategory;
    if (status !== undefined) updateData.status = status;

    if (tags !== undefined) updateData.tags = tags ? JSON.stringify(tags) : "[]";
    if (attachments !== undefined) updateData.attachments = attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : "[]";

    // Actualizar contactPersonId si se proporciona
    if (contactPersonId !== undefined) {
      updateData.contactPersonId = contactPersonId || null;
    }

    // Normalized category id
    if (categoryId !== undefined) {
      updateData.categoryId = categoryId || null;
    }

    // Actualizar campos adicionales si se proporcionan
    if (type !== undefined) updateData.type = type;
    if (date !== undefined) {
      // Parsear fecha correctamente (evitar problemas de zona horaria)
      if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        updateData.date = new Date(date + 'T12:00:00');
      } else {
        updateData.date = new Date(date);
      }
    }
    if (currency !== undefined) updateData.currency = currency;
    if (amount !== undefined) updateData.amount = Number(amount);

    // If exchangeRateId is provided, update the scalar field directly
    if (exchangeRateId !== undefined) {
      updateData.exchangeRateId = exchangeRateId || null;
    }

    // If currency/amount/exchangeRateId changed, recalculate derived amounts before saving
    if ((currency !== undefined || amount !== undefined || exchangeRateId !== undefined)) {
      // fetch the target exchange rate to use for calculations
      let exchangeRate = null;
      // Use the new exchangeRateId if provided, otherwise check existing
      const targetExchangeRateId = exchangeRateId !== undefined ? exchangeRateId : (await prisma.transaction.findUnique({ where: { id }, select: { exchangeRateId: true } }))?.exchangeRateId;

      if (targetExchangeRateId) {
        exchangeRate = await prisma.exchangeRate.findUnique({ where: { id: targetExchangeRateId } });
      }
      
      if (!exchangeRate) {
        // fallback to latest
        exchangeRate = await prisma.exchangeRate.findFirst({ orderBy: { date: 'desc' } });
      }

      let amountBs = undefined as number | undefined;
      let amountUsd = undefined as number | undefined;
      let amountEur = undefined as number | undefined;

      // Use new values or fallback to existing (we need to fetch existing if not provided)
      // To simplify, we only recalculate if we have the values. 
      // Ideally we should fetch the transaction if some values are missing.
      // Let's fetch current transaction data if needed.
      let currentAmount = amount !== undefined ? Number(amount) : undefined;
      let currentCurrency = currency;

      if (currentAmount === undefined || currentCurrency === undefined) {
         const currentTx = await prisma.transaction.findUnique({ where: { id }, select: { amount: true, currency: true } });
         if (currentTx) {
            if (currentAmount === undefined) currentAmount = currentTx.amount;
            if (currentCurrency === undefined) currentCurrency = currentTx.currency;
         }
      }

      if (currentAmount !== undefined && currentCurrency) {
        if (currentCurrency === 'BS') {
          amountBs = Number(currentAmount);
          if (exchangeRate) {
            const rateUsd = Number(exchangeRate.usdToBs);
            const rateEur = Number(exchangeRate.eurToBs);
            if (rateUsd && !isNaN(rateUsd) && rateUsd !== 0) amountUsd = amountBs / rateUsd;
            if (rateEur && !isNaN(rateEur) && rateEur !== 0) amountEur = amountBs / rateEur;
          }
        } else if (currentCurrency === 'USD') {
          amountUsd = Number(currentAmount);
          if (exchangeRate) {
            amountBs = amountUsd * Number(exchangeRate.usdToBs);
            amountEur = amountUsd * Number(exchangeRate.eurToUsd);
          }
        } else if (currentCurrency === 'EUR') {
          amountEur = Number(currentAmount);
          if (exchangeRate) {
            amountBs = amountEur * Number(exchangeRate.eurToBs);
            amountUsd = amountEur / Number(exchangeRate.eurToUsd);
          }
        }

        // Ensure no NaN or Infinity values
        if (amountBs !== undefined && Number.isFinite(amountBs)) updateData.amountBs = amountBs;
        if (amountUsd !== undefined && Number.isFinite(amountUsd)) updateData.amountUsd = amountUsd;
        if (amountEur !== undefined && Number.isFinite(amountEur)) updateData.amountEur = amountEur;
      }
    }

    // Clean undefined values explicitly to avoid Prisma errors
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    console.log('[updateTransaction] Updating with data:', JSON.stringify(updateData, null, 2));

    const transaction = await prisma.transaction.update({
      where: { id },
      data: updateData,
      include: {
        project: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        contactPerson: {
          select: {
            id: true,
            name: true,
            type: true,
            email: true,
          },
        },
        entries: {
          include: {
            debitAccount: true,
            creditAccount: true,
          },
        },
        categoryRef: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // === LOG DE ACTIVIDAD ===
    try {
      const { logActivity } = await import('../services/activityLog.service');
      await logActivity(
        (req as any).user?.id || 'system',
        'UPDATE',
        'Transaction',
        transaction.id,
        `Actualización de transacción ${transaction.code}`,
        {
          updatedFields: Object.keys(updateData),
          updateData,
        },
        req.ip,
        req.headers['user-agent'] as string
      );
    } catch (err) {
      console.error('Error registrando log de actividad (updateTransaction):', err);
    }
    res.json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
      },
    });
  }
};

/**
 * Cancelar una transacción
 */
export const cancelTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        entries: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Transacción no encontrada',
        },
      });
    }

    const hasAccess = await checkProjectWriteAccess(user, transaction.projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para cancelar transacciones en este proyecto' } });
    }

    if (transaction.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'La transacción ya está cancelada',
        },
      });
    }

    // Revertir los balances de las cuentas
    for (const entry of transaction.entries) {
      if (entry.debitAccountId && Number(entry.debitAmount) > 0) {
        await updateAccountBalance(entry.debitAccountId, transaction.currency as any, Number(entry.debitAmount), 'CREDIT');
      }
      if (entry.creditAccountId && Number(entry.creditAmount) > 0) {
        await updateAccountBalance(entry.creditAccountId, transaction.currency as any, Number(entry.creditAmount), 'DEBIT');
      }
    }

    // Cancelar pagos asociados si existen
    const allocations = await prisma.paymentAllocation.findMany({
      where: { transactionId: id },
      include: { payment: true }
    });

    for (const alloc of allocations) {
      // Si el pago está completado, lo cancelamos
      if (alloc.payment && alloc.payment.status !== 'CANCELLED') {
        await prisma.payment.update({
          where: { id: alloc.payment.id },
          data: { status: 'CANCELLED' }
        });
      }
    }

    // Marcar como cancelada
    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        project: true,
        entries: {
          include: {
            debitAccount: true,
            creditAccount: true,
          },
        },
        categoryRef: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: updatedTransaction,
      message: 'Transacción cancelada y balances revertidos',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
      },
    });
  }
};

/**
 * Eliminar una transacción (soft delete - solo si está en borrador)
 */
export const deleteTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Transacción no encontrada',
        },
      });
    }

    const hasAccess = await checkProjectWriteAccess(user, transaction.projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para eliminar transacciones en este proyecto' } });
    }

    if (transaction.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Solo se pueden eliminar transacciones en borrador. Use cancelar para otras transacciones.',
        },
      });
    }

    await prisma.transaction.delete({
      where: { id },
    });

    // === LOG DE ACTIVIDAD ===
    try {
      const { logActivity } = await import('../services/activityLog.service');
      await logActivity(
        (req as any).user?.id || 'system',
        'DELETE',
        'Transaction',
        transaction.id,
        `Eliminación de transacción ${transaction.code}`,
        {
          amount: transaction.amount,
          currency: transaction.currency,
          type: transaction.type,
          projectId: transaction.projectId
        },
        req.ip,
        req.headers['user-agent'] as string
      );
    } catch (err) {
      console.error('Error registrando log de actividad (deleteTransaction):', err);
    }

    res.json({
      success: true,
      message: 'Transacción eliminada correctamente',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
      },
    });
  }
};

/**
 * Listar categorías únicas de transacciones (por proyecto opcional)
 */
export const getTransactionCategories = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;

    const where: any = { category: { not: null } };
    if (projectId) where.projectId = projectId as string;

    // Obtener categorías únicas
    const rows = await prisma.transaction.findMany({
      where,
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });

    const categories = rows.map(r => r.category).filter(Boolean) as string[];

    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

/**
 * Función auxiliar para actualizar balance de cuenta
 */
// moved updateAccountBalance to services/account.service
