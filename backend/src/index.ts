import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

// Importar rutas
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import accountRoutes from './routes/account.routes';
import transactionRoutes from './routes/transaction.routes';
import paymentRoutes from './routes/payment.routes';
import transactionCategoryRoutes from './routes/transactionCategory.routes';
import documentRoutes from './routes/document.routes';
import exchangeRateRoutes from './routes/exchangeRate.routes';
import reportRoutes from './routes/report.routes';
import dashboardRoutes from './routes/dashboard.routes';
import loanRoutes from './routes/loan.routes';
import adminRoutes from './routes/admin.routes';
import aiRoutes from './routes/ai.routes';
import cfoRoutes from './routes/cfo.routes';
import scanRoutes from './routes/scan.routes';
import notificationRoutes from './routes/notification.routes';
import analyticsRoutes from './routes/analytics.routes';
import contactRoutes from './routes/contact.routes';
import productRoutes from './routes/product.routes';
import consolidationRoutes from './routes/consolidation.routes';
import invoiceRoutes from './routes/invoice.routes';
import recurringRoutes from './routes/recurring.routes';
import entryRoutes from './routes/entry.routes';
import settingsRoutes from './routes/settings.routes';
import transactionTemplateRoutes from './routes/transaction-template.routes';
import backupRoutes from './routes/backup.routes';
import publicRoutes from './routes/public.routes';

// Middlewares
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

// Servicios
import { initializeCronJobs } from './services/cron.service';
import { initializeWhatsApp } from './services/whatsapp.service';
import { initTelegramBot } from './services/telegram.service';

dotenv.config();

const app: Application = express();
// Default to 4002 in this dev environment to avoid common EADDRINUSE collisions on 4001/4000
const PORT = process.env.PORT || 4002;

// ============================================
// MIDDLEWARES GLOBALES
// ============================================

app.use(helmet({
  crossOriginResourcePolicy: false,
})); // Seguridad
app.use(compression()); // Compresión
app.use(morgan('dev')); // Logging
// Allow multiple dev origins (3000 and 3001) when CORS_ORIGIN is not set.
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN
  : 'http://localhost:3000,http://localhost:3001';

app.use(cors({
  origin: (origin, callback) => {
    // If no origin (server-to-server) allow
    if (!origin) return callback(null, true);
    const allowed = String(corsOrigin).split(',').map(s => s.trim());
    if (allowed.includes(origin)) return callback(null, true);
    // For debugging in dev, allow if origin contains 'localhost' or local network IP
    // Also allow our production domain subdomains
    if (
      origin.includes('localhost') || 
      origin.startsWith('http://192.168.') || 
      origin.startsWith('http://10.') ||
      origin.endsWith('.grupoaludra.com') // Allow any subdomain of grupoaludra.com
    ) return callback(null, true);
    return callback(new Error('CORS policy: origin not allowed'));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================
// RUTAS
// ============================================

import debugRoutes from './routes/debug.routes';
app.use('/api/debug', debugRoutes);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/transaction-templates', transactionTemplateRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/transaction-categories', transactionCategoryRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/exchange-rates', exchangeRateRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/cfo', cfoRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/products', productRoutes);
app.use('/api/consolidation-groups', consolidationRoutes);
app.use('/api/invoices', invoiceRoutes);
import auditRoutes from './routes/audit.routes';
import posRoutes from './routes/pos.routes';
app.use('/api/recurring', recurringRoutes);
app.use('/api/pos', posRoutes);
app.use('/api', auditRoutes);

app.use('/api/entries', entryRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/public', publicRoutes);

// ============================================
// MANEJO DE ERRORES
// ============================================

app.use(notFound);
app.use(errorHandler);

// ============================================
// INICIALIZACIÓN
// ============================================

import fs from 'fs';
// Clean up leak
// try { fs.unlinkSync('db_leak.txt'); } catch (e) {}

const startServer = async () => {

  try {
    // Inicializar servicios
    initializeCronJobs();

    // Inicializar WhatsApp (opcional)
    if (process.env.WHATSAPP_API_TOKEN) {
      await initializeWhatsApp();
      console.log('✅ WhatsApp service initialized');
    }
    
    // Inicializar Telegram Bot
    if (process.env.TELEGRAM_BOT_TOKEN) {
      initTelegramBot();
    }

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 API URL: http://localhost:${PORT}`);
      console.log(`💚 Health check: http://localhost:${PORT}/health\n`);
    });
  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
};

// Manejo de errores no capturados
process.on('unhandledRejection', (reason: any) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Iniciar servidor
startServer();

export default app;


// Trigger nodemon restart


// Trigger nodemon restart 2


// Restart for DB save


// Trigger nodemon restart 3

