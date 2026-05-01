const fs = require('fs');

const path = './src/services/recurring.service.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /console\.log\(\`🔁 Found \$\{dueRules\.length\} recurring rule\(s\) due\`\);/;
const replacement = `console.log(\`🔁 Found \${dueRules.length} recurring rule(s) due\`);

    const exchangeRate = await prisma.exchangeRate.findFirst({
      orderBy: { date: 'desc' }
    });
    
    const rateUsdToBs = exchangeRate?.usdToBs || 1;
    const rateEurToBs = exchangeRate?.eurToBs || 1;
    const rateEurToUsd = exchangeRate?.eurToUsd || 1;
`;

content = content.replace(regex, replacement);

const txRegex = /const trx = await prisma\.transaction\.create\(\{([\s\S]*?)entries: \{/;

const txReplacement = `
          let amountBs = 0;
          let amountUsd = 0;
          let amountEur = 0;
          const curr = rule.currency || 'USD';
          const amt = Number(rule.amount) || 0;

          if (curr === 'BS') {
            amountBs = amt;
            amountUsd = rateUsdToBs ? amt / rateUsdToBs : 0;
            amountEur = rateEurToBs ? amt / rateEurToBs : 0;
          } else if (curr === 'USD') {
            amountUsd = amt;
            amountBs = amt * rateUsdToBs;
            amountEur = rateEurToUsd ? amt / rateEurToUsd : 0;
          } else if (curr === 'EUR') {
            amountEur = amt;
            amountBs = amt * rateEurToBs;
            amountUsd = amt * rateEurToUsd;
          }

          amountBs = isNaN(amountBs) || !isFinite(amountBs) ? 0 : amountBs;
          amountUsd = isNaN(amountUsd) || !isFinite(amountUsd) ? 0 : amountUsd;
          amountEur = isNaN(amountEur) || !isFinite(amountEur) ? 0 : amountEur;

          const trx = await prisma.transaction.create({
$1
              amountBs,
              amountUsd,
              amountEur,
              entries: {`;

content = content.replace(txRegex, txReplacement);

fs.writeFileSync(path, content, 'utf8');
console.log('done');
