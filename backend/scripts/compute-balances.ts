import prisma from '../src/config/database';
import { getLatestExchangeRate } from '../src/services/exchangeRate.service';

async function main() {
  console.log('Computando balances por proyecto...');

  const rate = await getLatestExchangeRate(undefined);
  const usdToBs = rate ? Number(rate.usdToBs || 0) : 0;
  console.log('Tasa usada (usdToBs):', usdToBs, ' source:', rate?.source || 'N/A');

  // Also print latest rates by source to compare
  const latestBcv = await prisma.exchangeRate.findFirst({ where: { isOfficial: true }, orderBy: { date: 'desc' } });
  const latestApi = await prisma.exchangeRate.findFirst({ where: { source: 'API' }, orderBy: { date: 'desc' } });
  const latestCustom = await prisma.exchangeRate.findFirst({ where: { source: 'CUSTOM' }, orderBy: { date: 'desc' } });
  console.log('Latest BCV:', latestBcv ? `${latestBcv.usdToBs} (id=${latestBcv.id})` : 'none');
  console.log('Latest BINANCE/API:', latestApi ? `${latestApi.usdToBs} (id=${latestApi.id})` : 'none');
  console.log('Latest CUSTOM:', latestCustom ? `${latestCustom.usdToBs} (id=${latestCustom.id})` : 'none');

  const projects = await prisma.project.findMany({
    include: {
      transactions: { where: { status: 'COMPLETED' } },
      accounts: true
    }
  });

  let grand = {
    incomeUsd: 0,
    expensesUsd: 0,
    accountsUsdRecorded: 0,
    accountsBs: 0,
    accountsBsConfigured: 0,
    convertedUsdFromBs: 0,
    accountsUsdFinal: 0
  };

  for (const p of projects) {
    const incomeUsd = (p.transactions || []).filter((t:any) => t.type === 'INCOME').reduce((s:number,t:any)=>s+Number(t.amountUsd||0),0);
    const expensesUsd = (p.transactions || []).filter((t:any) => t.type === 'EXPENSE').reduce((s:number,t:any)=>s+Number(t.amountUsd||0),0);

    const accountsUsdRecorded = (p.accounts || []).reduce((s:number,a:any)=>s+Number(a.balanceUsd||0),0);
    const accountsBs = (p.accounts || []).reduce((s:number,a:any)=>s+Number(a.balanceBs||0),0);

    const accountsBsConfigured = (p.accounts || []).reduce((s:number,a:any)=>{
      const aUsd = Number(a.balanceUsd||0);
      const aBs = Number(a.balanceBs||0) || 0;
      if (typeof a.currency !== 'undefined' && a.currency !== null) {
        const cur = String(a.currency).toUpperCase();
        if (cur === 'BS' || cur === 'VES' || cur === 'BOLIVARES') return s + aBs;
        return s;
      }
      if ((!aUsd || aUsd === 0) && aBs > 0) return s + aBs;
      return s;
    },0);

  const convertedUsdFromBs = (usdToBs > 0 && accountsBsConfigured > 0) ? accountsBsConfigured / usdToBs : 0;
  const accountsUsdFinal = accountsUsdRecorded + convertedUsdFromBs;

  // Also compute conversions using BINANCE/API and CUSTOM if available
  const convertedWithApi = latestApi && Number(latestApi.usdToBs || 0) > 0 ? accountsBsConfigured / Number(latestApi.usdToBs) : 0;
  const convertedWithCustom = latestCustom && Number(latestCustom.usdToBs || 0) > 0 ? accountsBsConfigured / Number(latestCustom.usdToBs) : 0;

    grand.incomeUsd += incomeUsd;
    grand.expensesUsd += expensesUsd;
    grand.accountsUsdRecorded += accountsUsdRecorded;
    grand.accountsBs += accountsBs;
    grand.accountsBsConfigured += accountsBsConfigured;
    grand.convertedUsdFromBs += convertedUsdFromBs;
    grand.accountsUsdFinal += accountsUsdFinal;

    console.log('---');
    console.log(`Proyecto: ${p.name} (${p.code || p.id})`);
    console.log(` transacciones: ${p.transactions.length}  ingresosUsd: ${incomeUsd.toFixed(2)}  gastosUsd: ${expensesUsd.toFixed(2)}`);
    console.log(` cuentas - recorded USD: ${accountsUsdRecorded.toFixed(2)}  cuentas Bs total: ${accountsBs.toFixed(2)}  cuentas Bs configuradas: ${accountsBsConfigured.toFixed(2)}`);
    console.log(` convertido Bs->USD con BCV: ${convertedUsdFromBs.toFixed(2)}  cuentas USD finales (BCV): ${accountsUsdFinal.toFixed(2)}`);
    console.log(` convertido Bs->USD con API/BINANCE: ${convertedWithApi.toFixed(2)}`);
    console.log(` convertido Bs->USD con CUSTOM: ${convertedWithCustom.toFixed(2)}`);
  }

  console.log('=== RESUMEN GLOBAL ===');
  console.log(`ingresosUsd: ${grand.incomeUsd.toFixed(2)}  gastosUsd: ${grand.expensesUsd.toFixed(2)}`);
  console.log(`accountsUsdRecorded: ${grand.accountsUsdRecorded.toFixed(2)}  accountsBsTotal: ${grand.accountsBs.toFixed(2)}  accountsBsConfigured: ${grand.accountsBsConfigured.toFixed(2)}`);
  console.log(`convertedUsdFromBs (sum per-project): ${grand.convertedUsdFromBs.toFixed(2)}  accountsUsdFinal (sum): ${grand.accountsUsdFinal.toFixed(2)}`);

  process.exit(0);
}

main().catch(e=>{
  console.error('Error:', e);
  process.exit(1);
});
