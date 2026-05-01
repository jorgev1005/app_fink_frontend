import cron from 'node-cron';
import { updateExchangeRates } from './exchangeRate.service';
import { checkDueDocuments } from './document.service';
import { generateAIInsights } from './ai.service';
import { processDueRecurringRules } from './recurring.service';
import { BackupService } from './backup.service';

/**
 * Inicializar tareas programadas (Cron Jobs)
 */

export const initializeCronJobs = () => {
  // Inicializar servicio de respaldos (lee configuración de BD)
  BackupService.initScheduler().catch(err => {
    console.error('Failed to init backup scheduler:', err);
  });

  // Actualizar tasas de cambio cada hora (desde las 7 AM hasta las 7 PM) para asegurar datos frescos
  cron.schedule(
    process.env.EXCHANGE_RATE_UPDATE_CRON || '0 7-19 * * *',
    async () => {
      console.log('🔄 Running scheduled task: Update exchange rates');
      try {
        // Actualizar tasas:
        // 1. Oficial (BCV) -> Incluye USD (dolarapi) y EUR (exchangerate-api)
        // 2. Paralelo (Binance/API) -> USD (USDT)
        await updateExchangeRates('BCV');
        await updateExchangeRates('BINANCE');
        console.log('✅ Scheduled exchange rates update completed');
      } catch (error) {
        console.error('❌ Error in exchange rate cron job:', error);
      }
    },
    {
      timezone: 'America/Caracas'
    }
  );

  // Verificar documentos por vencer todos los días a las 8:00 AM
  cron.schedule(
    process.env.DOCUMENT_CHECK_CRON || '0 8 * * *',
    async () => {
      console.log('🔄 Running scheduled task: Check due documents');
      try {
        await checkDueDocuments();
      } catch (error) {
        console.error('❌ Error in document check cron job:', error);
      }
    },
    {
      timezone: 'America/Caracas'
    }
  );

  // Generar insights de IA cada semana (lunes a las 7:00 AM)
  cron.schedule(
    '0 7 * * 1',
    async () => {
      console.log('🔄 Running scheduled task: Generate AI insights');
      try {
        await generateAIInsights();
      } catch (error) {
        console.error('❌ Error in AI insights cron job:', error);
      }
    },
    {
      timezone: 'America/Caracas'
    }
  );

  // Procesar reglas recurrentes (por defecto cada hora)
  cron.schedule(
    process.env.RECURRING_RULES_CRON || '0 * * * *',
    async () => {
      console.log('🔄 Running scheduled task: Process recurring rules');
      try {
        await processDueRecurringRules();
      } catch (error) {
        console.error('❌ Error in recurring rules cron job:', error);
      }
    },
    {
      timezone: 'America/Caracas'
    }
  );

  console.log('⏰ Cron jobs scheduled successfully');
};
