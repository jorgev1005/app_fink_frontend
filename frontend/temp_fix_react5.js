const fs = require('fs');
let file = fs.readFileSync('src/app/loans/[id]/page.tsx', 'utf8');

// Replace api.get(`/loans/${loanId}`, ...) with api.loans.getLoan(loanId)
file = file.replace(/api\.get\(\`\/loans\/\$\{loanId\}\`, \{ headers \}\)/g, "api.loans.getLoan(loanId)");

// Replace api.get('/accounts', ...) with api.accounts.getAccounts(projectId)
file = file.replace(/api\.get\('\/accounts', \{ headers \}\)/g, "api.accounts.getAccounts(projectId as string)");

// Fix payment modal POST calls
// api.post(`/loans/${loanId}/payment`, paymentData, { headers }) -> api.loans.addPayment(loanId, paymentData)
file = file.replace(/api\.post\(\`\/loans\/\$\{loanId\}\/payment\`, paymentData, \{ headers \}\)/g, "api.loans.addPayment(loanId, paymentData)");

// Add charge POST calls
// api.post(`/loans/${loanId}/charge`, chargeData, { headers }) -> api.loans.addCharge(loanId, chargeData)
file = file.replace(/api\.post\(\`\/loans\/\$\{loanId\}\/charge\`, chargeData, \{ headers \}\)/g, "api.loans.addCharge(loanId, chargeData)");

fs.writeFileSync('src/app/loans/[id]/page.tsx', file);
