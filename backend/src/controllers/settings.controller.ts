import { Request, Response } from 'express';
import prisma from '../config/database';

// Keys (legacy) used in SystemConfig — kept for fallback
const makeProjectUserKey = (projectId: string, userId: string) => `parse_threshold:project:${projectId}:user:${userId}`;
const makeUserKey = (userId: string) => `parse_threshold:user:${userId}`;

export const getParseThreshold = async (req: Request, res: Response) => {
  try {
    const projectId = String(req.query.projectId || '').trim() || undefined;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { message: 'Not authenticated' } });

    // Prefer ProjectSetting model (project+user), fallback to SystemConfig legacy keys
    try {
      // project-scoped
      if (projectId) {
        const ps = await prisma.projectSetting.findUnique({ where: { projectId_userId_key: { projectId, userId, key: 'parse_threshold' } } });
          if (ps) {
            const v = (ps.value as any)?.threshold as number | undefined;
            if (typeof v === 'number') return res.json({ success: true, data: { threshold: v, source: 'project' } });
          }
      }

      // user-only (projectId null)
      const pu = await prisma.projectSetting.findFirst({ where: { projectId: null, userId, key: 'parse_threshold' } });
      if (pu) {
        const v = (pu.value as any)?.threshold as number | undefined;
        if (typeof v === 'number') return res.json({ success: true, data: { threshold: v, source: 'user' } });
      }
    } catch (e) {
      // If projectSetting is not present for some reason, continue to legacy fallback
      console.warn('[getParseThreshold] projectSetting read failed, falling back to SystemConfig', (e as any)?.message ?? e);
    }

    // Fallback to legacy SystemConfig keys
    if (projectId) {
      const key = makeProjectUserKey(projectId, userId);
      const found = await prisma.systemConfig.findUnique({ where: { key } });
      if (found) {
        const parsed = typeof found.value === 'string' ? JSON.parse(found.value) : found.value as any;
        const v = parsed?.threshold ?? Number(found.value) ?? undefined;
        if (typeof v === 'number') return res.json({ success: true, data: { threshold: v, source: 'project' } });
      }
    }

    const ukey = makeUserKey(userId);
    const uf = await prisma.systemConfig.findUnique({ where: { key: ukey } });
    if (uf) {
      const parsed = typeof uf.value === 'string' ? JSON.parse(uf.value) : uf.value as any;
      const v = parsed?.threshold ?? Number(uf.value) ?? undefined;
      if (typeof v === 'number') return res.json({ success: true, data: { threshold: v, source: 'user' } });
    }

    // default
    return res.json({ success: true, data: { threshold: 0.85, source: 'default' } });
  } catch (error: any) {
    console.error('[getParseThreshold] error', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const saveParseThreshold = async (req: Request, res: Response) => {
  try {
    const { projectId, threshold, scope } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { message: 'Not authenticated' } });
    const t = Number(threshold);
    if (!Number.isFinite(t) || t <= 0 || t >= 1) return res.status(400).json({ success: false, error: { message: 'Invalid threshold' } });

    // Prefer ProjectSetting model
    try {
      if (scope === 'project') {
        if (!projectId) return res.status(400).json({ success: false, error: { message: 'projectId required for project scope' } });
        // upsert by composite unique (projectId, userId, key)
        await prisma.projectSetting.upsert({
          where: { projectId_userId_key: { projectId, userId, key: 'parse_threshold' } },
          update: { value: JSON.stringify({ threshold: t }) },
          create: { projectId, userId, key: 'parse_threshold', value: JSON.stringify({ threshold: t }) }
        });
        return res.json({ success: true, data: { threshold: t, saved: true, source: 'project' } });
      } else {
        // user-only (projectId null) - findFirst + update/create to avoid null in composite where
        const existing = await prisma.projectSetting.findFirst({ where: { projectId: null, userId, key: 'parse_threshold' } });
        if (existing) {
          await prisma.projectSetting.update({ where: { id: existing.id }, data: { value: JSON.stringify({ threshold: t }) } });
        } else {
          await prisma.projectSetting.create({ data: { projectId: null, userId, key: 'parse_threshold', value: JSON.stringify({ threshold: t }) } });
        }
        return res.json({ success: true, data: { threshold: t, saved: true, source: 'user' } });
      }
    } catch (e) {
      console.warn('[saveParseThreshold] projectSetting upsert failed, falling back to SystemConfig', (e as any)?.message ?? e);
      // continue to legacy fallback if projectSetting not available
    }

    // Legacy fallback to SystemConfig
    let key = makeUserKey(userId);
    if (scope === 'project') {
      if (!projectId) return res.status(400).json({ success: false, error: { message: 'projectId required for project scope' } });
      key = makeProjectUserKey(projectId, userId);
    }

    // Upsert into SystemConfig (key unique)
    const existing = await prisma.systemConfig.findUnique({ where: { key } });
    const value = { threshold: t } as any;
    if (existing) {
      const updated = await prisma.systemConfig.update({ where: { key }, data: { value } });
      return res.json({ success: true, data: { threshold: t, saved: true, key, source: scope === 'project' ? 'project' : 'user' } });
    } else {
      const created = await prisma.systemConfig.create({ data: { key, value } });
      return res.json({ success: true, data: { threshold: t, saved: true, key, source: scope === 'project' ? 'project' : 'user' } });
    }
  } catch (error: any) {
    console.error('[saveParseThreshold] error', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export default { getParseThreshold, saveParseThreshold };
