import { Request, Response } from 'express';
import prisma from '../config/database';
import { getProjectAccessFilter } from '../utils/projectAccess';

type ConsolidationCurrency = 'BS' | 'USD' | 'EUR' | 'MIXED' | null;

const getAccountBalanceByCurrency = (account: any, currency: ConsolidationCurrency) => {
  if (currency === 'USD') return Number(account.balanceUsd || 0);
  if (currency === 'EUR') return Number(account.balanceEur || 0);
  return Number(account.balanceBs || 0);
};

const enrichGroupWithSummary = (group: any) => {
  const linkedAccounts = (group.accounts || []).map((item: any) => item.account).filter(Boolean);
  const currencies = [...new Set(linkedAccounts.map((account: any) => account.currency).filter(Boolean))];

  let consolidatedCurrency: ConsolidationCurrency = null;
  let consolidatedBalance = 0;

  if (currencies.length === 1) {
    consolidatedCurrency = currencies[0] as ConsolidationCurrency;
    consolidatedBalance = linkedAccounts.reduce(
      (sum: number, account: any) => sum + getAccountBalanceByCurrency(account, consolidatedCurrency),
      0,
    );
  } else if (currencies.length > 1) {
    consolidatedCurrency = 'MIXED';
  }

  return {
    ...group,
    consolidatedCurrency,
    consolidatedBalance,
  };
};

export const listConsolidationGroups = async (req: Request, res: Response) => {
  try {
    const groups = await prisma.consolidationGroup.findMany({
      where: { ownerId: req.user!.id },
      include: {
        accounts: {
          include: { account: { include: { project: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: groups.map(enrichGroupWithSummary) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const createConsolidationGroup = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const ownerId = req.user!.id;

  const group = await prisma.consolidationGroup.create({
      data: { name, description, ownerId }
    });

    res.status(201).json({ success: true, data: group });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getConsolidationGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const group = await prisma.consolidationGroup.findFirst({
      where: { id, ownerId: req.user!.id },
      include: { accounts: { include: { account: { include: { project: true } } } } }
    });

    if (!group) return res.status(404).json({ success: false, error: { message: 'Group not found' } });

    res.json({ success: true, data: enrichGroupWithSummary(group) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const updateConsolidationGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

  const group = await prisma.consolidationGroup.updateMany({
      where: { id, ownerId: req.user!.id },
      data: { name, description }
    });

    if (group.count === 0) return res.status(404).json({ success: false, error: { message: 'Group not found or not permitted' } });

  const updated = await prisma.consolidationGroup.findUnique({ where: { id } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// Replace accounts in a group (idempotent)
export const replaceGroupAccounts = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { accountIds } = req.body as { accountIds: string[] };
    const uniqueAccountIds = [...new Set((accountIds || []).filter(Boolean))];

    // Verify ownership
    const group = await prisma.consolidationGroup.findFirst({ where: { id, ownerId: req.user!.id } });
    if (!group) return res.status(404).json({ success: false, error: { message: 'Group not found or not permitted' } });

    if (uniqueAccountIds.length) {
      const accounts = await prisma.account.findMany({
        where: {
          id: { in: uniqueAccountIds },
          ...getProjectAccessFilter(req.user!),
        },
        select: {
          id: true,
          currency: true,
        },
      });

      if (accounts.length !== uniqueAccountIds.length) {
        return res.status(400).json({
          success: false,
          error: { message: 'Una o más cuentas no existen o no están disponibles para este usuario' },
        });
      }

      const currencies = [...new Set(accounts.map((account) => account.currency).filter(Boolean))];
      if (currencies.length > 1) {
        return res.status(400).json({
          success: false,
          error: { message: 'Solo puedes consolidar cuentas que tengan la misma moneda' },
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.consolidationGroupAccount.deleteMany({ where: { groupId: id } });
      if (uniqueAccountIds.length) {
        const rows = uniqueAccountIds.map((accountId: any) => ({ groupId: id, accountId }));
        await tx.consolidationGroupAccount.createMany({ data: rows });
      }
    });

    const updated = await prisma.consolidationGroup.findUnique({ where: { id }, include: { accounts: { include: { account: { include: { project: true } } } } } });
    res.json({ success: true, data: enrichGroupWithSummary(updated) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const previewConsolidationGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const group = await prisma.consolidationGroup.findFirst({
      where: { id, ownerId: req.user!.id },
      include: { accounts: { include: { account: { include: { project: true } } } } }
    });
    if (!group) return res.status(404).json({ success: false, error: { message: 'Group not found' } });

    const groupWithSummary = enrichGroupWithSummary(group);

    // Build a simple export structure per account
    const accountsData = (group.accounts || []).map((ga: any) => {
      const a = ga.account;
      return {
        accountId: a.id,
        code: a.code,
        name: a.name,
        currency: a.currency,
        projectId: a.project?.id || null,
        projectName: a.project?.name || null,
        balanceBs: a.balanceBs ? a.balanceBs.toString() : '0',
        balanceUsd: a.balanceUsd ? a.balanceUsd.toString() : '0',
        balanceEur: a.balanceEur ? a.balanceEur.toString() : '0'
      };
    });

    res.json({
      success: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          description: group.description,
          consolidatedCurrency: groupWithSummary.consolidatedCurrency,
          consolidatedBalance: groupWithSummary.consolidatedBalance,
        },
        accounts: accountsData,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const deleteConsolidationGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
  const deleted = await prisma.consolidationGroup.deleteMany({ where: { id, ownerId: req.user!.id } });
    if (deleted.count === 0) return res.status(404).json({ success: false, error: { message: 'Group not found or not permitted' } });
    res.json({ success: true, message: 'Group deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export default {
  listConsolidationGroups,
  createConsolidationGroup,
  getConsolidationGroup,
  updateConsolidationGroup,
  replaceGroupAccounts,
  deleteConsolidationGroup
};
