import prisma from '../config/database';

export async function resolveProjectId(projectRef: string | undefined | null) {
  if (!projectRef) return null;
  // try by id
  const byId = await prisma.project.findUnique({ where: { id: projectRef } as any });
  if (byId) return byId.id;
  // try by code
  const byCode = await prisma.project.findUnique({ where: { code: projectRef } as any });
  if (byCode) return byCode.id;
  return null;
}

export default resolveProjectId;
