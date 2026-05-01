
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { scanInvoice } from '../controllers/scan.controller';

const router = Router();

// Ensure upload directory exists
const uploadDir = 'uploads/temp_scan/';
if (!fs.existsSync(uploadDir)){
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
    } catch (err) {
        console.error('Error creating temp upload dir:', err);
    }
}

// Configure Multer for temp storage
const upload = multer({ 
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /api/scan/invoice
router.post('/invoice', upload.single('image'), scanInvoice);

export default router;
