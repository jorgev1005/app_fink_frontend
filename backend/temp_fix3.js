const fs = require('fs');

let routes = fs.readFileSync('src/routes/loan.routes.ts', 'utf8');
routes = routes.replace('../middlewares/auth.middleware', '../middleware/auth');
fs.writeFileSync('src/routes/loan.routes.ts', routes);

let service = fs.readFileSync('src/services/loan.service.ts', 'utf8');

// Fix Account creation
service = service.replace(
  "type: 'LIABILITY',",
  "type: 'LIABILITY',\n      subType: 'OTHER_LIABILITIES',"
);

// Fix entries in createLoan
service = service.replace(
  /entries: {\s*create: \[\s*{\s*\/\/ The bank receives the money \(Asset = Debit\)\s*debitAccountId: destinationAccountId,\s*amount: Number\(principalAmount\),\s*currency: currency \|\| 'USD',\s*amountBs: Number\(principalAmount\) \* 40,\s*amountUsd: currency === 'USD' \? Number\(principalAmount\) : 0,\s*amountEur: currency === 'EUR' \? Number\(principalAmount\) : 0,\s*},\s*{\s*\/\/ The liability account generates the debt \(Liability = Credit\)\s*creditAccountId: liabilityAccount.id,\s*amount: Number\(principalAmount\),\s*currency: currency \|\| 'USD',\s*amountBs: Number\(principalAmount\) \* 40,\s*amountUsd: currency === 'USD' \? Number\(principalAmount\) : 0,\s*amountEur: currency === 'EUR' \? Number\(principalAmount\) : 0,\s*}\s*\]\s*}/,
  `entries: {\n          create: [\n            {\n              debitAccountId: destinationAccountId,\n              debitAmount: Number(principalAmount),\n            },\n            {\n              creditAccountId: liabilityAccount.id,\n              creditAmount: Number(principalAmount),\n            }\n          ]\n        }`
);

// Fix entries in addLoanPayment
service = service.replace(
  /entries\.push\(\{\s*debitAccountId: loan\.linkedAccountId, \/\/ Reducir pasivo\s*amount: Number\(principalAmount\),\s*currency: loan\.currency,\s*amountBs: Number\(principalAmount\) \* 40,\s*amountUsd: loan\.currency === 'USD' \? Number\(principalAmount\) : 0,\s*amountEur: loan\.currency === 'EUR' \? Number\(principalAmount\) : 0,\s*\}\);/,
  `entries.push({\n        debitAccountId: loan.linkedAccountId,\n        debitAmount: Number(principalAmount),\n      });`
);

service = service.replace(
  /entries\.push\(\{\s*\/\/ TEMPORARY[\s\S]*?debitAccountId: loan\.linkedAccountId,\s*amount: Number\(interestAmount\),\s*currency: loan\.currency,\s*amountBs: Number\(interestAmount\) \* 40,\s*amountUsd: loan\.currency === 'USD' \? Number\(interestAmount\) : 0,\s*amountEur: loan\.currency === 'EUR' \? Number\(interestAmount\) : 0,\s*\}\);/,
  `entries.push({\n        debitAccountId: loan.linkedAccountId,\n        debitAmount: Number(interestAmount),\n      });`
);

service = service.replace(
  /entries\.push\(\{\s*creditAccountId: bankAccountId,\s*amount: Number\(totalAmount\),\s*currency: loan\.currency,\s*amountBs: Number\(totalAmount\) \* 40,\s*amountUsd: loan\.currency === 'USD' \? Number\(totalAmount\) : 0,\s*amountEur: loan\.currency === 'EUR' \? Number\(totalAmount\) : 0,\s*\}\);/,
  `entries.push({\n      creditAccountId: bankAccountId,\n      creditAmount: Number(totalAmount),\n    });`
);

fs.writeFileSync('src/services/loan.service.ts', service);
console.log('Fixed loan TS errors');
