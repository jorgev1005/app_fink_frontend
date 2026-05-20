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
