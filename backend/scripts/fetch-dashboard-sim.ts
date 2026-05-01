import prisma from '../src/config/database';
import { getLatestExchangeRate, convertCurrency } from '../src/services/exchangeRate.service';

async function buildDashboard(currency: 'USD' | 'BS' = 'USD') {
  const projects = await prisma.project.findMany({
    include: {
      transactions: { where: { status: 'COMPLETED' } },
      documents: true,
      accounts: true
    }
  });

  let totalIncomeUsd = 0;
  let totalExpensesUsd = 0;
  let totalIncomeBs = 0;
  let totalExpensesBs = 0;

  const rateForConversion = await getLatestExchangeRate(undefined);
  const sourceToUse = undefined;

  const projectsData = await Promise.all(projects.map(async p => {
    const incomeUsd = p.transactions.filter((t:any)=>t.type==='INCOME').reduce((s:number,t:any)=>s+Number(t.amountUsd||0),0);
    const expensesUsd = p.transactions.filter((t:any)=>t.type==='EXPENSE').reduce((s:number,t:any)=>s+Number(t.amountUsd||0),0);
    const incomeBs = p.transactions.filter((t:any)=>t.type==='INCOME').reduce((s:number,t:any)=>s+Number(t.amountBs||0),0);
    const expensesBs = p.transactions.filter((t:any)=>t.type==='EXPENSE').reduce((s:number,t:any)=>s+Number(t.amountBs||0),0);

    totalIncomeUsd += incomeUsd;
    totalExpensesUsd += expensesUsd;
    totalIncomeBs += incomeBs;
    totalExpensesBs += expensesBs;

    const accountsBalanceBs = (p.accounts || []).reduce((s:number,a:any)=>s+Number(a.balanceBs||0),0);
    const accountsBalanceUsdRecorded = (p.accounts || []).reduce((s:number,a:any)=>s+Number(a.balanceUsd||0),0);
    const accountsBalanceBsConfigured = (p.accounts || []).reduce((s:number,a:any)=>{
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

    const usdToBs = rateForConversion ? Number(rateForConversion.usdToBs || 0) : 0;
    const convertedUsdFromBs = (usdToBs > 0 && accountsBalanceBsConfigured > 0) ? accountsBalanceBsConfigured / usdToBs : 0;
    const accountsBalanceUsd = accountsBalanceUsdRecorded + convertedUsdFromBs;

    const projectResult: any = {
      id: p.id,
      name: p.name,
      code: p.code,
      color: p.color,
      transactionCount: p.transactions.length,
      incomeUsd,
      expensesUsd,
      incomeBs,
      expensesBs,
      balanceUsd: incomeUsd - expensesUsd + accountsBalanceUsd,
      balanceBs: incomeBs - expensesBs + accountsBalanceBs,
      accountsBalanceUsd,
      accountsBalanceBs,
      accountsBalanceBsConfigured
    };

    if (currency === 'USD') {
      try {
        const converted = await convertCurrency(incomeBs - expensesBs + accountsBalanceBs, 'BS', 'USD', sourceToUse);
        projectResult.requestedCurrencyBalance = (incomeUsd - expensesUsd + accountsBalanceUsd) + converted;
      } catch (e) {
        projectResult.requestedCurrencyBalance = null;
      }
    } else if (currency === 'BS') {
      try {
        const converted = await convertCurrency(incomeUsd - expensesUsd + accountsBalanceUsd, 'USD', 'BS', sourceToUse);
        projectResult.requestedCurrencyBalance = (incomeBs - expensesBs + accountsBalanceBs) + converted;
      } catch (e) {
        projectResult.requestedCurrencyBalance = null;
      }
    }

    return projectResult;
  }));

  const totalAccountsBalanceUsd = projectsData.reduce((s:number,p:any)=>s+Number(p.accountsBalanceUsd||0),0);
  const totalAccountsBalanceBs = projectsData.reduce((s:number,p:any)=>s+Number(p.accountsBalanceBs||0),0);

  const totalBalanceUsd = (totalIncomeUsd - totalExpensesUsd) + totalAccountsBalanceUsd;
  const totalBalanceBs = (totalIncomeBs - totalExpensesBs) + totalAccountsBalanceBs;

  let totalBalanceRequested: number | null = null;
  if (currency === 'USD') {
    try {
      const converted = await convertCurrency(totalBalanceBs, 'BS', 'USD', sourceToUse);
      totalBalanceRequested = totalBalanceUsd + converted;
    } catch { totalBalanceRequested = null; }
  } else {
    try {
      const converted = await convertCurrency(totalBalanceUsd, 'USD', 'BS', sourceToUse);
      totalBalanceRequested = totalBalanceBs + converted;
    } catch { totalBalanceRequested = null; }
  }

  const summary = {
    totalIncomeUsd, totalExpensesUsd, totalBalanceUsd,
    totalIncomeBs, totalExpensesBs, totalBalanceBs,
    requestedCurrency: currency,
    requestedCurrencyTotal: totalBalanceRequested,
    rateUsed: rateForConversion,
    projectCount: projects.length
  };

  return { summary, projects: projectsData };
}

async function main() {
  const res = await buildDashboard('USD');
  // Print only PERSONAL (PERS-001) and the summary
  const personal = res.projects.find((p:any) => p.code === 'PERS-001' || p.name?.toUpperCase().includes('PERSONAL'));
  console.log(JSON.stringify({ summary: res.summary, personal }, null, 2));
  process.exit(0);
}

main().catch(e=>{ console.error(e); process.exit(1); });
