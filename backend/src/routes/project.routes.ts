import { Router } from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectSummary,
  pauseProject,
  reactivateProject,
  uploadProjectLogo
} from '../controllers/project.controller';
import { 
  getMembers, 
  inviteMember, 
  removeMember, 
  updateMemberRole 
} from '../controllers/projectMember.controller';
// Pausar proyecto
import { authenticate, authorize } from '../middleware/auth';
import { authorizeProjectRole } from '../middleware/projectAuth';
import { validate } from '../middleware/validate';

const router = Router();

// Configure multer for logos
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '../../uploads/logos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    // Generar nombre único para evitar problemas de caché y colisiones
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `logo-${uniqueSuffix}${ext}`);
  }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(null, false);
        }
    }
});

// Todas las rutas requieren autenticación
router.use(authenticate);

// Upload Logo
router.post('/:id/logo', upload.single('logo'), uploadProjectLogo);

// Pausar proyecto
router.post('/:id/pause', pauseProject);

// Reactivar proyecto
router.post('/:id/reactivate', reactivateProject);

// Obtener todos los proyectos del usuario
router.get('/', getProjects);

// Obtener resumen financiero de un proyecto
router.get('/:id/summary', getProjectSummary);

// Obtener un proyecto por ID
router.get('/:id', getProjectById);

// Crear proyecto
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('code').notEmpty().withMessage('El código es requerido'),
    validate
  ],
  createProject
);

// Actualizar proyecto
router.put('/:id', updateProject);

// Members Management
router.get('/:id/members', authorizeProjectRole('VIEWER'), getMembers);
router.post('/:id/members', authorizeProjectRole('MANAGER'), inviteMember);
router.put('/:id/members/:userId', authorizeProjectRole('MANAGER'), updateMemberRole);
router.delete('/:id/members/:userId', authorizeProjectRole('MANAGER'), removeMember);

// Eliminar proyecto (solo admins y owners)
router.delete('/:id', authorizeProjectRole('OWNER'), deleteProject);

export default router;
