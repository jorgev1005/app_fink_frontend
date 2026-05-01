import { Request, Response } from 'express';
import prisma from '../config/database';
import { checkProjectWriteAccess } from '../utils/projectAccess';

export const getMembers = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // project id
    
    const members = await prisma.projectUser.findMany({
      where: { projectId: id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      }
    });

    res.json({ success: true, data: members });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const inviteMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // project id
    const { email, role = 'MEMBER' } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: { message: 'El email es obligatorio' } });
    }

    const hasAccess = await checkProjectWriteAccess(req.user!, id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para invitar miembros a este proyecto' } });
    }

    // Buscar al usuario por correo
    const userToInvite = await prisma.user.findUnique({
      where: { email }
    });

    if (!userToInvite) {
      return res.status(404).json({ success: false, error: { message: 'Usuario no encontrado. Debe registrarse primero.' } });
    }

    // Verificar si ya es miembro
    if (!userToInvite.id) {
      console.error('[projectMember.controller] userToInvite.id missing:', userToInvite);
      return res.status(400).json({ success: false, error: { message: 'El usuario a invitar no tiene id' } });
    }
    const existingMembership = await prisma.projectUser.findUnique({
      where: {
        projectId_userId: {
          projectId: id,
          userId: userToInvite.id
        }
      }
    });
    if (existingMembership) {
      return res.status(400).json({ success: false, error: { message: 'El usuario ya es miembro de este proyecto' } });
    }

    // Crear la relación
    const newMember = await prisma.projectUser.create({
      data: {
        projectId: id,
        userId: userToInvite.id,
        role: role.toUpperCase()
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(201).json({ success: true, data: newMember });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const removeMember = async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params; // project id, user id to remove

    const hasAccess = await checkProjectWriteAccess(req.user!, id);
    if (!hasAccess && userId !== req.user!.id) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para eliminar miembros de este proyecto' } });
    }

    if (userId === req.user!.id) {
       // Preventing self-removal if it's the last owner? Logic could be added here.
    }

    await prisma.projectUser.delete({
      where: {
        projectId_userId: {
          projectId: id,
          userId: userId
        }
      }
    });

    res.json({ success: true, message: 'Miembro eliminado correctamente' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const updateMemberRole = async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;

    const hasAccess = await checkProjectWriteAccess(req.user!, id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para modificar roles en este proyecto' } });
    }

    if (userId === req.user!.id) {
       // Prevent downgrading your own role if you are the only owner? 
       // For simplicity, we allow it but warn.
    }

    const updatedMember = await prisma.projectUser.update({
      where: {
        projectId_userId: {
          projectId: id,
          userId: userId
        }
      },
      data: { role: role.toUpperCase() },
      include: {
        user: {
           select: {
             id: true,
             email: true,
             firstName: true,
             lastName: true
           }
        }
      }
    });

    res.json({ success: true, data: updatedMember });
  } catch (error: any) {
     res.status(500).json({ success: false, error: { message: error.message } });
  }
};
