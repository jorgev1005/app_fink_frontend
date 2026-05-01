import prisma from '../config/database';

/**
 * Verifica si un usuario tiene permisos de escritura (crear, editar, eliminar) en un proyecto.
 * Retorna true si es ADMIN o si es miembro del proyecto con un rol superior a VIEWER.
 */
export const checkProjectWriteAccess = async (user: any, projectId: string): Promise<boolean> => {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (!user.id) {
    console.error('[checkProjectWriteAccess] user.id missing:', user);
    return false;
  }
  const membership = await prisma.projectUser.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: user.id
      }
    }
  });
  if (!membership) return false;
  if (membership.role.toUpperCase() === 'VIEWER') return false;
  return true;
};

/**
 * Retorna el filtro de Prisma para asegurar que el usuario solo vea datos de sus proyectos.
 * Si es ADMIN, retorna un objeto vacío (sin filtro).
 */
export const getProjectAccessFilter = (user: any) => {
  if (!user) return { projectId: 'none' }; // Fallback seguro
  if (user.role === 'ADMIN') return {};
  
  return {
    project: {
      users: {
        some: { userId: user.id }
      }
    }
  };
};
