import { Router } from 'express';
import multer from 'multer';
import {
  registerDocument,
  renderCertifiedViewer,
  serveCertifiedFile,
  confirmCertifiedReceipt,
  downloadCertificatePDF,
  certifyInvoiceById,
  getCertifiedDeliveries,
  getCertifiedDeliveryDetail
} from '../controllers/certification.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Endpoint administrativo / API para registrar documentos
router.post('/api/certified/register', upload.single('file'), registerDocument);
router.post('/api/certified/certify-invoice/:id', certifyInvoiceById);
router.get('/api/certified/deliveries', getCertifiedDeliveries);
router.get('/api/certified/deliveries/:id', getCertifiedDeliveryDetail);

// Endpoints públicos para los destinatarios (enlaces de WhatsApp)
router.get('/cert/v/:token', renderCertifiedViewer);
router.get('/cert/file/:token', serveCertifiedFile);
router.post('/cert/confirm/:token', confirmCertifiedReceipt);
router.get('/cert/acta/:token', downloadCertificatePDF);

export default router;
