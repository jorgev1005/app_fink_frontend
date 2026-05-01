import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/accounts', async (req, res) => {
  try {
    const projectCode = req.query.code as string || 'PER-04';
    const project = await prisma.project.findFirst({
        where: { code: projectCode },
        include: { accounts: true }
    });
    
    if (!project) return res.json({ error: 'Project not found' });
    
    return res.json({
        project: project.name,
        accounts: project.accounts.map(a => ({
            id: a.id,
            code: a.code,
            name: a.name,
            balanceUsd: a.balanceUsd,
            balanceBs: a.balanceBs,
            isActive: a.isActive,
            // Include currency to be sure
            currency: a.currency
        }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/fix-account/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const account = await prisma.account.update({
            where: { id },
            data: { isActive: false }
        });
        res.json({ success: true, account });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
