import { Request, Response } from 'express';
import prisma from '../config/database';

// Recalculate balances for all accounts based on transaction entries per currency
export const recalculateBalancesEndpoint = async (req: Request, res: Response) => {
  try {
    const accounts = await prisma.account.findMany({ select: { id: true, code: true, name: true } });
    const updated: any[] = [];

    for (const a of accounts) {
      // BS
      const debitsBs = await prisma.transactionEntry.aggregate({ where: { debitAccountId: a.id, transaction: { currency: 'BS' } }, _sum: { debitAmount: true } });
      const creditsBs = await prisma.transactionEntry.aggregate({ where: { creditAccountId: a.id, transaction: { currency: 'BS' } }, _sum: { creditAmount: true } });
      const balanceBs = Number(debitsBs._sum.debitAmount || 0) - Number(creditsBs._sum.creditAmount || 0);

      // USD
      const debitsUsd = await prisma.transactionEntry.aggregate({ where: { debitAccountId: a.id, transaction: { currency: 'USD' } }, _sum: { debitAmount: true } });
      const creditsUsd = await prisma.transactionEntry.aggregate({ where: { creditAccountId: a.id, transaction: { currency: 'USD' } }, _sum: { creditAmount: true } });
      const balanceUsd = Number(debitsUsd._sum.debitAmount || 0) - Number(creditsUsd._sum.creditAmount || 0);

      // EUR
      const debitsEur = await prisma.transactionEntry.aggregate({ where: { debitAccountId: a.id, transaction: { currency: 'EUR' } }, _sum: { debitAmount: true } });
      const creditsEur = await prisma.transactionEntry.aggregate({ where: { creditAccountId: a.id, transaction: { currency: 'EUR' } }, _sum: { creditAmount: true } });
      const balanceEur = Number(debitsEur._sum.debitAmount || 0) - Number(creditsEur._sum.creditAmount || 0);

      await prisma.account.update({ where: { id: a.id }, data: { balanceBs: balanceBs as any, balanceUsd: balanceUsd as any, balanceEur: balanceEur as any } });

      updated.push({ accountId: a.id, code: a.code, name: a.name, balanceBs, balanceUsd, balanceEur });
    }

    res.json({ success: true, updatedCount: updated.length, updated });
  } catch (error: any) {
    console.error('recalculateBalances error:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const restartApp = async (req: Request, res: Response) => {
  try {
    // Respond first so the client knows the command was received
    res.json({ success: true, message: 'Restarting application...' });
    
    // Give time to send the response before exiting
    setTimeout(() => {
      console.log('Restarting application via process.exit...');
      process.exit(0); 
    }, 1000);
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// Recalculate balances for all accounts based on transaction entries
export const recalculateBalances = async (req: Request, res: Response) => {
  try {
    // Set all balances to zero first
    await prisma.account.updateMany({ data: { balanceBs: 0, balanceUsd: 0, balanceEur: 0 } });

    // Aggregate sums from transaction entries grouped by account and currency
    // We'll sum debitAmount - creditAmount for each account to get net change
    const entries = await prisma.transactionEntry.findMany({
      include: { transaction: true }
    });

    const accountSums: Record<string, { bs: number; usd: number; eur: number }> = {};

    for (const e of entries) {
      const currency = e.transaction.currency;
      // debit account
      if (e.debitAccountId) {
        accountSums[e.debitAccountId] = accountSums[e.debitAccountId] || { bs: 0, usd: 0, eur: 0 };
        const v = Number(e.debitAmount || 0);
        if (currency === 'BS') accountSums[e.debitAccountId].bs += v;
        else if (currency === 'USD') accountSums[e.debitAccountId].usd += v;
        else if (currency === 'EUR') accountSums[e.debitAccountId].eur += v;
      }
      // credit account (subtract)
      if (e.creditAccountId) {
        accountSums[e.creditAccountId] = accountSums[e.creditAccountId] || { bs: 0, usd: 0, eur: 0 };
        const v = Number(e.creditAmount || 0);
        if (currency === 'BS') accountSums[e.creditAccountId].bs -= v;
        else if (currency === 'USD') accountSums[e.creditAccountId].usd -= v;
        else if (currency === 'EUR') accountSums[e.creditAccountId].eur -= v;
      }
    }

    // Apply updates in batches
    const updates = Object.entries(accountSums).map(([accountId, sums]) =>
      prisma.account.update({ where: { id: accountId }, data: { balanceBs: sums.bs, balanceUsd: sums.usd, balanceEur: sums.eur } })
    );

    await Promise.all(updates);

    res.json({ success: true, message: 'Balances recalculated', updatedAccounts: updates.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// Obtener todos los usuarios con sus proyectos asignados
export const getAllUsersWithProjects = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        projects: {
          include: {
            project: {
              select: { id: true, name: true, code: true, color: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// Crear o invitar usuario y asignarle proyectos iniciales
export const createOrInviteUser = async (req: Request, res: Response) => {
  try {
    const { email, firstName, lastName, password, role = 'USER', projectIds = [], projectRole = 'MEMBER' } = req.body;
    
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: { message: 'El correo electrónico es requerido.' } });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(409).json({ success: false, error: { message: 'Este correo electrónico ya se encuentra registrado.' } });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password || 'Fink2026*', 10);

    const newUser = await prisma.user.create({
      data: {
        email: cleanEmail,
        firstName: (firstName || '').trim(),
        lastName: (lastName || '').trim(),
        password: hashedPassword,
        role: role || 'USER',
        projects: {
          create: (projectIds || []).map((pId: string) => ({
            projectId: pId,
            role: (projectRole || 'MEMBER').toUpperCase()
          }))
        }
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        projects: {
          include: {
            project: { select: { id: true, name: true, code: true, color: true } }
          }
        }
      }
    });

    res.status(201).json({ success: true, data: newUser });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// Asignar o actualizar proyectos a un usuario específico
export const setUserProjectAssignments = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { assignments } = req.body; // Array of { projectId: string, role?: string }

    if (!Array.isArray(assignments)) {
      return res.status(400).json({ success: false, error: { message: 'El cuerpo de la petición debe contener un arreglo assignments.' } });
    }

    await prisma.$transaction(async (tx) => {
      // Eliminar asignaciones previas del usuario objetivo
      await tx.projectUser.deleteMany({ where: { userId } });

      // Crear las nuevas asignaciones
      if (assignments.length > 0) {
        await tx.projectUser.createMany({
          data: assignments.map((a: { projectId: string; role?: string }) => ({
            userId,
            projectId: a.projectId,
            role: (a.role || 'MEMBER').toUpperCase()
          }))
        });
      }
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        projects: {
          include: {
            project: { select: { id: true, name: true, code: true, color: true } }
          }
        }
      }
    });

    res.json({ success: true, data: updatedUser });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

