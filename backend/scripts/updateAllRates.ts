import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { updateExchangeRates, createCustomRate } from '../src/services/exchangeRate.service';

const prisma = new PrismaClient();

async function run() {
  console.log('🚀 Iniciando actualización de todas las tasas (BCV, BINANCE, CUSTOM fallback)');

  // Intentar actualizar BCV
  try {
    console.log('➡️ Intentando updateExchangeRates("BCV")');
    await updateExchangeRates('BCV');
    console.log('✅ updateExchangeRates("BCV") completado');
  } catch (e: any) {
    console.warn('⚠️ Error actualizando BCV automáticamente:', e.message || e);
  }

  // Intentar actualizar BINANCE
  try {
    console.log('➡️ Intentando updateExchangeRates("BINANCE")');
    await updateExchangeRates('BINANCE');
    console.log('✅ updateExchangeRates("BINANCE") completado');
  } catch (e: any) {
    console.warn('⚠️ Error actualizando BINANCE automáticamente:', e.message || e);
  }

  // Comprobar si hay registros en BD; si no, usar valores de entorno (fallback manual)
  try {
    const bcv = await prisma.exchangeRate.findFirst({ where: { source: 'BCV' }, orderBy: { date: 'desc' } });
    const binance = await prisma.exchangeRate.findFirst({ where: { source: 'API' }, orderBy: { date: 'desc' } });
    const custom = await prisma.exchangeRate.findFirst({ where: { source: 'CUSTOM' }, orderBy: { date: 'desc' } });

    if (!bcv) {
      const envUsd = process.env.FALLBACK_BCV_USD_TO_BS ? Number(process.env.FALLBACK_BCV_USD_TO_BS) : undefined;
      const envEur = process.env.FALLBACK_BCV_EUR_TO_BS ? Number(process.env.FALLBACK_BCV_EUR_TO_BS) : undefined;
        if (envUsd) {
        console.log('ℹ️ No encontré BCV en BD; creando fallback desde env FALLBACK_BCV_USD_TO_BS');
        await prisma.exchangeRate.create({ data: { source: 'BCV', usdToBs: envUsd, eurToBs: envEur || 0, eurToUsd: envEur && envUsd ? Number((envEur / envUsd).toFixed(6)) : 0, isOfficial: true, isFallback: true } });
      } else {
        console.log('ℹ️ No hay FALLBACK_BCV_USD_TO_BS, omitiendo creación BCV fallback');
      }
    } else {
      console.log('ℹ️ BCV existente en BD:', bcv.usdToBs ? `USD→Bs ${bcv.usdToBs}` : 'sin valor');
    }

    if (!binance) {
      const envBin = process.env.FALLBACK_BINANCE_USD_TO_BS ? Number(process.env.FALLBACK_BINANCE_USD_TO_BS) : undefined;
      if (envBin) {
        console.log('ℹ️ No encontré BINANCE en BD; creando fallback desde env FALLBACK_BINANCE_USD_TO_BS');
        await prisma.exchangeRate.create({ data: { source: 'API', usdToBs: envBin, eurToBs: 0, eurToUsd: 0, isOfficial: false, isFallback: true } });
      } else {
        console.log('ℹ️ No hay FALLBACK_BINANCE_USD_TO_BS, omitiendo creación BINANCE fallback');
      }
    } else {
      console.log('ℹ️ BINANCE existente en BD:', binance.usdToBs ? `USD→Bs ${binance.usdToBs}` : 'sin valor');
    }

    if (!custom) {
      const envCustom = process.env.FALLBACK_CUSTOM_USD_TO_BS ? Number(process.env.FALLBACK_CUSTOM_USD_TO_BS) : undefined;
      const envCustomEur = process.env.FALLBACK_CUSTOM_EUR_TO_BS ? Number(process.env.FALLBACK_CUSTOM_EUR_TO_BS) : undefined;
      if (envCustom) {
        console.log('ℹ️ No encontré CUSTOM en BD; creando CUSTOM desde env FALLBACK_CUSTOM_USD_TO_BS');
        await createCustomRate(envCustom, envCustomEur || 0, 'Fallback custom creado desde env', true);
      } else {
        console.log('ℹ️ No hay FALLBACK_CUSTOM_USD_TO_BS, omitiendo creación CUSTOM fallback');
      }
    } else {
      console.log('ℹ️ CUSTOM existente en BD:', custom.usdToBs ? `USD→Bs ${custom.usdToBs}` : 'sin valor');
    }

    console.log('🏁 Finalizado: revisión y creación de tasas completada');
  } catch (error: any) {
    console.error('❌ Error revisando/creando rates fallback:', error.message || error);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error('❌ Error ejecución updateAllRates:', e);
  process.exit(1);
});
