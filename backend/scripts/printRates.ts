import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    const latest = await prisma.exchangeRate.findMany({ orderBy: { date: 'desc' }, take: 20 });
    console.log('Últimas tasas (hasta 20):');
    latest.forEach((r) => {
      console.log(`${r.id} | ${r.date.toISOString()} | ${r.source} | USD→Bs: ${r.usdToBs} | EUR→Bs: ${r.eurToBs} | notes: ${r.notes || ''}`);
    });

    const bcv = await prisma.exchangeRate.findFirst({ where: { source: 'BCV' }, orderBy: { date: 'desc' } });
    const api = await prisma.exchangeRate.findFirst({ where: { source: 'API' }, orderBy: { date: 'desc' } });
    const custom = await prisma.exchangeRate.findFirst({ where: { source: 'CUSTOM' }, orderBy: { date: 'desc' } });

    console.log('\nResumen por fuente:');
    console.log('BCV:', bcv ? `USD→Bs ${bcv.usdToBs} | EUR→Bs ${bcv.eurToBs} | notes: ${bcv.notes || ''}` : 'no encontrado');
    console.log('API (BINANCE/market):', api ? `USD→Bs ${api.usdToBs} | EUR→Bs ${api.eurToBs} | notes: ${api.notes || ''}` : 'no encontrado');
    console.log('CUSTOM:', custom ? `USD→Bs ${custom.usdToBs} | EUR→Bs ${custom.eurToBs} | notes: ${custom.notes || ''}` : 'no encontrado');
  } catch (e: any) {
    console.error('Error consultando BD:', e.message || e);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error('Error ejecutando printRates:', e);
  process.exit(1);
});
