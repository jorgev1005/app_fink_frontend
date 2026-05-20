const fs = require('fs');

let file = fs.readFileSync('src/app/loans/new/page.tsx', 'utf8');

// replace accounts get
file = file.replace("api.get('/accounts', { headers })", "api.accounts.getAll({ projectId: projectId as string })");

// replace contacts get
file = file.replace("api.get('/contacts', { headers })", "api.contacts.getAll({ projectId: projectId as string })");

// replace creating loan
file = file.replace("api.post('/loans', payload, { headers })", "api.loans.createLoan(payload)");

fs.writeFileSync('src/app/loans/new/page.tsx', file);
