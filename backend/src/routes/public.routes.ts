import { Router } from 'express';
import { 
  getPublicCatalog, 
  createPublicProduct, 
  generateAiDescription, 
  getPublicProjects, 
  ensurePublicProject, 
  assignProjectToProduct,
  createPublicContact,
  createPublicInvoice,
  getPublicDraftInvoices
} from '../controllers/public.controller';

const router = Router();

// Endpoint público para que el bot y el catálogo web consuman el inventario
router.get('/catalog', getPublicCatalog);

// Endpoint público para que genera_sku envíe nuevos productos a FINK
router.post('/products', createPublicProduct);

// Endpoint público para generar descripciones con IA
router.post('/ai/description', generateAiDescription);

// Endpoints públicos para el Bot de WhatsApp (CRM)
router.post('/contacts', createPublicContact);
router.post('/invoices', createPublicInvoice);
router.get('/invoices/drafts', getPublicDraftInvoices);

// ==========================================
// ENDPOINTS PARA n8n (ORQUESTACIÓN)
// ==========================================
// Buscar/listar proyectos (GET /api/public/projects?code=LUC)
router.get('/projects', getPublicProjects);
// Crear proyecto si no existe (usado por n8n para auto-crear el proyecto LUC, ALU, etc.)
router.post('/projects', ensurePublicProject);
// Asignar un proyecto a un producto por SKU
router.patch('/products/:sku/assign-project', assignProjectToProduct);

export default router;
