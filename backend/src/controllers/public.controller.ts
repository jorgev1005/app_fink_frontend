import { Request, Response } from 'express';
import prisma from '../config/database';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Para pruebas puedes usar baseURL de OpenRouter si no tienes openai directa
  baseURL: process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1"
});

export const getPublicCatalog = async (req: Request, res: Response) => {
  try {
    const { projectCode } = req.query;
    let projectId: string | undefined;

    if (projectCode && typeof projectCode === 'string') {
        const project = await prisma.project.findUnique({ where: { code: projectCode } });
        if (project) {
            projectId = project.id;
        }
    }

    const whereClause: any = {
      isActive: true,
      isPublic: true,
      forSale: true,
    };
    if (projectId) {
        whereClause.projectId = projectId;
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: { project: true },
      orderBy: { name: 'asc' },
    });
    
    // Map data slightly to match what Aludra catalog expects
    const catalogData = products.map((p: any) => ({
      ...p,
      precio_usd: p.unitPrice,
      nombre_producto: p.name,
      projectCode: p.project?.code || 'ALU',
      colores_disponibles: p.colores_disponibles ? JSON.parse(p.colores_disponibles) : ["Consultar"],
      project: undefined // remove full project object
    }));

    res.json({ success: true, data: catalogData });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const createPublicProduct = async (req: Request, res: Response) => {
  try {
    const {
      name,
      sku,
      unitPrice = 0,
      division,
      descuentos_volumen,
      fuente_tasa = 'bcv',
      projectCode,
      description,
      costPrice,
      packagingCost,
      medidas,
      empaqueLargoCm,
      empaqueAnchoCm,
      empaqueAltoCm,
      largoCm,
      anchoCm,
      altoCm,
      unidad_empaque,
      pedido_minimo,
      tiempo_entrega,
      empaqueCantidad,
      empaquePesoKg,
      pesoUnitarioKg,
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: { message: 'Name is required' } });
    }

    let projectId: string | undefined;
    if (projectCode) {
        const project = await prisma.project.findUnique({ where: { code: projectCode } });
        if (project) {
            projectId = project.id;
        } else {
            console.warn(`Project code ${projectCode} not found for public product creation.`);
        }
    }

    let product;
    if (sku) {
      product = await prisma.product.upsert({
        where: { sku },
        update: {
          name,
          unitPrice,
          division: division || 'Aludra Terra (Agro)',
          projectId,
          descuentos_volumen,
          fuente_tasa,
          description,
          ...(costPrice !== undefined && { costPrice: parseFloat(costPrice) }),
          ...(packagingCost !== undefined && { packagingCost: parseFloat(packagingCost) }),
          medidas,
          unidad_empaque,
          pedido_minimo,
          tiempo_entrega,
          ...(empaqueLargoCm !== undefined && { empaqueLargoCm: parseFloat(empaqueLargoCm) }),
          ...(empaqueAnchoCm !== undefined && { empaqueAnchoCm: parseFloat(empaqueAnchoCm) }),
          ...(empaqueAltoCm !== undefined && { empaqueAltoCm: parseFloat(empaqueAltoCm) }),
          ...(largoCm !== undefined && { largoCm: parseFloat(largoCm) }),
          ...(anchoCm !== undefined && { anchoCm: parseFloat(anchoCm) }),
          ...(altoCm !== undefined && { altoCm: parseFloat(altoCm) }),
          ...(empaqueCantidad !== undefined && { empaqueCantidad: parseInt(empaqueCantidad) }),
          ...(empaquePesoKg !== undefined && { empaquePesoKg: parseFloat(empaquePesoKg) }),
          ...(pesoUnitarioKg !== undefined && { pesoUnitarioKg: parseFloat(pesoUnitarioKg) }),
        },
        create: {
          name,
          sku,
          unitPrice,
          currency: 'USD',
          division: division || 'Aludra Terra (Agro)',
          projectId,
          descuentos_volumen,
          fuente_tasa,
          isPublic: true,
          isActive: true,
          forSale: true,
          description,
          costPrice: costPrice !== undefined ? parseFloat(costPrice) : 0,
          packagingCost: packagingCost !== undefined ? parseFloat(packagingCost) : 0,
          medidas,
          unidad_empaque,
          pedido_minimo,
          tiempo_entrega,
          empaqueLargoCm: empaqueLargoCm !== undefined ? parseFloat(empaqueLargoCm) : 0,
          empaqueAnchoCm: empaqueAnchoCm !== undefined ? parseFloat(empaqueAnchoCm) : 0,
          empaqueAltoCm: empaqueAltoCm !== undefined ? parseFloat(empaqueAltoCm) : 0,
          largoCm: largoCm !== undefined ? parseFloat(largoCm) : 0,
          anchoCm: anchoCm !== undefined ? parseFloat(anchoCm) : 0,
          altoCm: altoCm !== undefined ? parseFloat(altoCm) : 0,
          empaqueCantidad: empaqueCantidad !== undefined ? parseInt(empaqueCantidad) : 1,
          empaquePesoKg: empaquePesoKg !== undefined ? parseFloat(empaquePesoKg) : 0,
          pesoUnitarioKg: pesoUnitarioKg !== undefined ? parseFloat(pesoUnitarioKg) : 0,
        },
      });
    } else {
      product = await prisma.product.create({
        data: {
          name,
          sku,
          unitPrice,
          currency: 'USD',
          division: division || 'Aludra Terra (Agro)',
          projectId,
          descuentos_volumen,
          fuente_tasa,
          isPublic: true,
          isActive: true,
          forSale: true,
          description,
          medidas,
          unidad_empaque,
          pedido_minimo,
          tiempo_entrega,
          empaqueLargoCm: empaqueLargoCm !== undefined ? parseFloat(empaqueLargoCm) : 0,
          empaqueAnchoCm: empaqueAnchoCm !== undefined ? parseFloat(empaqueAnchoCm) : 0,
          empaqueAltoCm: empaqueAltoCm !== undefined ? parseFloat(empaqueAltoCm) : 0,
          largoCm: largoCm !== undefined ? parseFloat(largoCm) : 0,
          anchoCm: anchoCm !== undefined ? parseFloat(anchoCm) : 0,
          altoCm: altoCm !== undefined ? parseFloat(altoCm) : 0,
          empaqueCantidad: empaqueCantidad !== undefined ? parseInt(empaqueCantidad) : 1,
          empaquePesoKg: empaquePesoKg !== undefined ? parseFloat(empaquePesoKg) : 0,
          pesoUnitarioKg: pesoUnitarioKg !== undefined ? parseFloat(pesoUnitarioKg) : 0,
        },
      });
    }

    res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const generateAiDescription = async (req: Request, res: Response) => {
  try {
    const { productName, category } = req.body;
    
    if (!productName) {
      return res.status(400).json({ success: false, error: { message: 'Product name is required' } });
    }

    const prompt = `Eres un experto redactor de marketing. Redacta una descripción comercial muy atractiva, persuasiva y concisa (máximo 2 párrafos cortos) para un producto llamado "${productName}" de la categoría "${category || 'General'}". Resalta sus beneficios y usa lenguaje que invite a la compra.`;

    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini", 
      messages: [{ role: "user", content: prompt }],
    });

    const description = completion.choices[0]?.message?.content?.trim();

    res.json({ success: true, data: { description } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// GET /api/public/projects?code=LUC  — busca un proyecto por código
export const getPublicProjects = async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    const where: any = {};
    if (code && typeof code === 'string') where.code = code;

    const projects = await prisma.project.findMany({
      where,
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: projects });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// POST /api/public/projects  — crea un proyecto si no existe (usado por n8n)
export const ensurePublicProject = async (req: Request, res: Response) => {
  try {
    const { code, name } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, error: { message: 'code and name are required' } });
    }

    // findOrCreate pattern
    let project = await prisma.project.findUnique({ where: { code } });
    let created = false;
    if (!project) {
      // Buscar el usuario dueño por email configurado en .env (FINK_OWNER_EMAIL)
      const ownerEmail = process.env.FINK_OWNER_EMAIL;
      const ownerUser = ownerEmail
        ? await prisma.user.findFirst({ where: { email: ownerEmail } })
        : await prisma.user.findFirst({ where: { role: 'ADMIN' } });

      if (!ownerUser) {
        return res.status(500).json({ success: false, error: { message: 'No se encontró el usuario dueño del proyecto. Configura FINK_OWNER_EMAIL en .env' } });
      }

      project = await prisma.project.create({
        data: {
          name,
          code,
          users: { create: { userId: ownerUser.id, role: 'ADMIN' } },
        },
      });
      created = true;
      console.log(`[n8n] Proyecto creado automáticamente: ${name} (${code}) — asignado a ${ownerUser.email}`);
    }

    res.status(created ? 201 : 200).json({ success: true, created, data: { id: project.id, name: project.name, code: project.code } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};


// PATCH /api/public/products/:sku/assign-project  — asigna un projectId a un producto por SKU
export const assignProjectToProduct = async (req: Request, res: Response) => {
  try {
    const { sku } = req.params;
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ success: false, error: { message: 'projectId is required' } });
    }

    const product = await prisma.product.findUnique({ where: { sku } });
    if (!product) {
      return res.status(404).json({ success: false, error: { message: `Product with SKU ${sku} not found` } });
    }

    const updated = await prisma.product.update({
      where: { sku },
      data: { projectId },
    });

    console.log(`[n8n] Producto ${sku} asignado al proyecto ${projectId}`);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// POST /api/public/contacts  — busca o crea un contacto cliente por teléfono/RIF
export const createPublicContact = async (req: Request, res: Response) => {
  try {
    const { name, phone, email, taxId, projectCode = 'LUC' } = req.body;
    if (!name && !phone) {
      return res.status(400).json({ success: false, error: { message: 'name or phone are required' } });
    }

    // Buscar el proyecto (por defecto LUC / Inversiones Lucem)
    const project = await prisma.project.findUnique({ where: { code: projectCode } });
    if (!project) {
      return res.status(404).json({ success: false, error: { message: `Project code ${projectCode} not found` } });
    }

    // Buscar contacto existente
    let contact = null;
    if (phone) {
      contact = await prisma.contactPerson.findFirst({
        where: {
          projectId: project.id,
          phone: phone
        }
      });
    }
    if (!contact && taxId) {
      contact = await prisma.contactPerson.findFirst({
        where: {
          projectId: project.id,
          taxId: taxId
        }
      });
    }

    let created = false;
    if (!contact) {
      contact = await prisma.contactPerson.create({
        data: {
          name: name || `Contacto ${phone || taxId}`,
          phone: phone || null,
          email: email || null,
          taxId: taxId || null,
          type: 'CUSTOMER',
          projectId: project.id
        }
      });
      created = true;
      console.log(`[Bot] Contacto creado: ${contact.name} (${phone || ''})`);
    } else {
      // Opcional: Actualizar el nombre o datos si venían vacíos y ahora vienen con valor
      const updateData: any = {};
      if (!contact.taxId && taxId) updateData.taxId = taxId;
      if (!contact.email && email) updateData.email = email;
      if (name && contact.name.startsWith('Contacto ') && contact.name !== name) updateData.name = name;

      if (Object.keys(updateData).length > 0) {
        contact = await prisma.contactPerson.update({
          where: { id: contact.id },
          data: updateData
        });
      }
    }

    res.status(created ? 201 : 200).json({ success: true, created, data: contact });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// POST /api/public/invoices  — crea una factura en borrador (DRAFT)
export const createPublicInvoice = async (req: Request, res: Response) => {
  try {
    const { 
      customerId, phone, currency = 'USD', total, items, description = 'Cotización desde WhatsApp', projectCode = 'LUC' 
    } = req.body;

    if (!total || Number(total) <= 0) {
      return res.status(400).json({ success: false, error: { message: 'total must be > 0' } });
    }

    const project = await prisma.project.findUnique({ where: { code: projectCode } });
    if (!project) {
      return res.status(404).json({ success: false, error: { message: `Project code ${projectCode} not found` } });
    }

    let resolvedCustomerId = customerId;
    if (!resolvedCustomerId && phone) {
      const contact = await prisma.contactPerson.findFirst({
        where: { projectId: project.id, phone }
      });
      if (contact) {
        resolvedCustomerId = contact.id;
      }
    }

    if (!resolvedCustomerId) {
      return res.status(400).json({ success: false, error: { message: 'customerId or phone is required to link a contact' } });
    }

    const invoiceCode = `INV-BOT-${Date.now()}`;

    // Estructurar líneas
    const formattedItems = Array.isArray(items) ? items.map((it: any) => ({
      productId: it.productId || 'CUSTOM',
      name: it.name || it.nombre_producto || 'Artículo',
      quantity: Number(it.quantity || 1),
      price: Number(it.price || it.precio_usd || 0),
      total: Number((it.quantity || 1) * (it.price || it.precio_usd || 0))
    })) : [];

    const finalLinesData = {
      items: formattedItems,
      taxAmount: 0, // Por ahora 0 en borrador, o se puede calcular si es taxable
      description: description
    };

    // Crear factura en DRAFT
    const result = await prisma.invoice.create({
      data: {
        project: { connect: { id: project.id } },
        code: invoiceCode,
        type: 'INVOICE', // Venta
        customerId: resolvedCustomerId,
        issueDate: new Date(),
        currency,
        total: Number(total),
        outstanding: Number(total),
        status: 'DRAFT',
        lines: JSON.stringify(finalLinesData),
        createdBy: 'whatsapp-bot'
      }
    });

    console.log(`[Bot] Factura DRAFT creada: ${result.code} por ${result.total} ${result.currency}`);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getPublicDraftInvoices = async (req: Request, res: Response) => {
  try {
    const drafts = await prisma.invoice.findMany({
      where: {
        status: 'DRAFT',
        createdBy: 'whatsapp-bot',
      },
      orderBy: {
        issueDate: 'desc',
      },
    });

    // Obtener los IDs de clientes únicos de forma segura
    const customerIds = Array.from(new Set(drafts.map(d => d.customerId).filter(Boolean))) as string[];

    // Buscar los contactos correspondientes
    const customers = await prisma.contactPerson.findMany({
      where: {
        id: { in: customerIds }
      }
    });

    // Mapear los contactos a cada factura
    const data = drafts.map(invoice => {
      const customer = customers.find(c => c.id === invoice.customerId) || null;
      return {
        ...invoice,
        customer
      };
    });

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
