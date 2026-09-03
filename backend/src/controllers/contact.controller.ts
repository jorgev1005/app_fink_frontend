import { Request, Response } from 'express';
import prisma from '../config/database';
import { getProjectAccessFilter, checkProjectWriteAccess } from '../utils/projectAccess';

// GET /api/contacts - Listar contactos con búsqueda
export const getContacts = async (req: Request, res: Response) => {
  try {
    const { projectId, search, type, limit } = req.query;

    const where: any = {
      ...getProjectAccessFilter(req.user!)
    };

    if (projectId) {
      where.projectId = projectId as string;
    }

    if (search) {
      const s = (search as string).trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { taxId: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (type) {
      if (type === 'CUSTOMER') {
        where.type = { in: ['CUSTOMER', 'BOTH'] };
      } else if (type === 'SUPPLIER') {
        where.type = { in: ['SUPPLIER', 'BOTH'] };
      } else {
        where.type = type;
      }
    }

    where.isActive = true;

    const contacts = await prisma.contactPerson.findMany({
      where,
      ...(limit ? { take: parseInt(limit as string) } : {}),
      orderBy: { name: 'asc' },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: contacts,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
};

// GET /api/contacts/:id - Obtener un contacto por ID
export const getContactById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const contact = await prisma.contactPerson.findFirst({
      where: { 
        id,
        ...getProjectAccessFilter(req.user!)
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        transactions: {
          take: 10,
          orderBy: { date: 'desc' },
          select: {
            id: true,
            code: true,
            date: true,
            type: true,
            description: true,
            amount: true,
            currency: true,
          },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: { message: 'Contacto no encontrado' },
      });
    }

    res.json({
      success: true,
      data: contact,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
};

// POST /api/contacts - Crear un nuevo contacto
export const createContact = async (req: Request, res: Response) => {
  try {
    const { name, type, email, phone, address, taxId, projectId, notes } = req.body;

    // Validaciones
    if (!name || !projectId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Nombre y proyecto son requeridos' },
      });
    }

    const hasAccess = await checkProjectWriteAccess(req.user!, projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para crear contactos en este proyecto' } });
    }

    // Validar duplicados en el mismo proyecto por RIF (taxId) o por Nombre
    const cleanTaxId = taxId && typeof taxId === 'string' ? taxId.trim().toUpperCase() : null;
    const cleanName = name.trim();

    if (cleanTaxId) {
      const existingTax = await prisma.contactPerson.findFirst({
        where: {
          projectId,
          isActive: true,
          taxId: { equals: cleanTaxId, mode: 'insensitive' }
        }
      });
      if (existingTax) {
        return res.status(400).json({
          success: false,
          error: { message: `Ya existe un contacto con este RIF/Identificación (${cleanTaxId}) en este proyecto: "${existingTax.name}".` }
        });
      }
    }

    const existingName = await prisma.contactPerson.findFirst({
      where: {
        projectId,
        isActive: true,
        name: { equals: cleanName, mode: 'insensitive' }
      }
    });
    if (existingName) {
      return res.status(400).json({
        success: false,
        error: { message: `Ya existe un contacto con este nombre en este proyecto: "${existingName.name}".` }
      });
    }

    const contact = await prisma.contactPerson.create({
      data: {
        name,
        type: type || 'OTHER',
        email,
        phone,
        address,
        taxId,
        projectId,
        notes,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: contact,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
};

// PUT /api/contacts/:id - Actualizar un contacto
export const updateContact = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, email, phone, address, taxId, notes, isActive } = req.body;

    const existing = await prisma.contactPerson.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Contacto no encontrado' } });

    const hasAccess = await checkProjectWriteAccess(req.user!, existing.projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para modificar este contacto' } });
    }

    if (taxId && typeof taxId === 'string') {
      const cleanTaxId = taxId.trim().toUpperCase();
      const existingTax = await prisma.contactPerson.findFirst({
        where: {
          id: { not: id },
          projectId: existing.projectId,
          isActive: true,
          taxId: { equals: cleanTaxId, mode: 'insensitive' }
        }
      });
      if (existingTax) {
        return res.status(400).json({
          success: false,
          error: { message: `Ya existe otro contacto con este RIF/Identificación (${cleanTaxId}) en este proyecto: "${existingTax.name}".` }
        });
      }
    }

    if (name && typeof name === 'string') {
      const cleanName = name.trim();
      const existingName = await prisma.contactPerson.findFirst({
        where: {
          id: { not: id },
          projectId: existing.projectId,
          isActive: true,
          name: { equals: cleanName, mode: 'insensitive' }
        }
      });
      if (existingName) {
        return res.status(400).json({
          success: false,
          error: { message: `Ya existe otro contacto con este nombre en este proyecto: "${existingName.name}".` }
        });
      }
    }

    const contact = await prisma.contactPerson.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(taxId !== undefined && { taxId }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: contact,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
};

// DELETE /api/contacts/:id - Eliminar (desactivar) un contacto
export const deleteContact = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.contactPerson.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Contacto no encontrado' } });

    const hasAccess = await checkProjectWriteAccess(req.user!, existing.projectId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: { message: 'No tienes permisos para eliminar este contacto' } });
    }

    // Desactivar en lugar de eliminar para mantener historial
    const contact = await prisma.contactPerson.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      data: contact,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
};
