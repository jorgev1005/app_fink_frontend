import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  cancelTransaction,
  deleteTransaction,
  getTransactionCategories,
  uploadTransactionAttachments,
  deleteTransactionAttachment,
  forceMarkPaid,
} from '../controllers/transaction.controller';

const router = Router();

router.use(authenticate);

// Configure multer storage per-transaction
// Allowed mime types and extensions
const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const id = req.params.id || 'tmp';
    const dir = path.join(__dirname, '../../uploads/transactions', id);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      // ignore
    }
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Tipo de archivo no permitido'));
  },
});

// CRUD de transacciones
router.get('/', getTransactions);
// Listar categorías (antes de rutas con :id)
router.get('/categories', getTransactionCategories);
router.get('/:id', getTransactionById);
router.post('/', createTransaction);
router.put('/:id', updateTransaction);
router.patch('/:id/force-paid', forceMarkPaid);
router.delete('/:id', deleteTransaction);

// Acciones especiales
router.post('/:id/cancel', cancelTransaction);

// Attachments
router.post('/:id/attachments', upload.array('files'), uploadTransactionAttachments);
router.delete('/:id/attachments', deleteTransactionAttachment);

export default router;
