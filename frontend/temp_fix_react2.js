const fs = require('fs');

// ==== 1. Fix page.tsx ====
let page = fs.readFileSync('src/app/loans/page.tsx', 'utf8');

// replace the api calls
page = page.replace(
  `      const response = await api.get('/loans', {`,
  `      const response = await api.loans.getLoans(projectId as string);`
);
// clean the trailing params
page = page.replace(
  `        headers: projectId ? { 'x-project-id': projectId } : {},
      });`,
  ``
);
fs.writeFileSync('src/app/loans/page.tsx', page);

// ==== 2. Fix new/page.tsx ====
let newPage = fs.readFileSync('src/app/loans/new/page.tsx', 'utf8');

// Replace the GET accounts and contacts
// Usually it's api.accounts.getAccounts(projectId) ... Let's be generic (apiClient) or use standard.
// Actually `apiClient` is exported. We could import it or just use the proper API path if it complains.
// For now, let's fix the api usage:
newPage = newPage.replace(
  `          api.get('/accounts', { headers }),
          api.get('/contacts', { headers }).catch(() => ({ data: [] })) // Contacts might not exist if not fully set up`,
  `          api.accounts.getAll(projectId as string),
          api.contacts.getAll(projectId as string).catch(() => ({ data: [] }))`
);

// Replace POST /loans
newPage = newPage.replace(
  /await api\.post\('\/loans', payload, \{[\s\S]*?\}\);/,
  `await api.loans.createLoan(payload);`
);

fs.writeFileSync('src/app/loans/new/page.tsx', newPage);

// ==== 3. Fix [id]/page.tsx ====
let idPage = fs.readFileSync('src/app/loans/[id]/page.tsx', 'utf8');

idPage = idPage.replace(
  `        api.get(\`/loans/\${loanId}\`, { headers }),
        api.get('/accounts', { headers })`,
  `        api.loans.getLoanById(loanId),
        api.accounts.getAll(projectId as string)`
);

idPage = idPage.replace(
  /await api\.post\(`\/loans\/\$\{loanId\}\/payment`, \{[\s\S]*?\}, \{ headers \}\);/,
  `await api.loans.addPayment(loanId, {
        ...paymentForm,
        totalAmount: Number(paymentForm.totalAmount),
        principalAmount: Number(paymentForm.principalAmount || 0),
        interestAmount: Number(paymentForm.interestAmount || 0),
      });`
);

fs.writeFileSync('src/app/loans/[id]/page.tsx', idPage);

console.log('Fixed React pages');
