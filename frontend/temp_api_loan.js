const fs = require('fs');
let apiText = fs.readFileSync('src/lib/api.ts', 'utf8');

if (!apiText.includes('loansAPI =')) {
  // Inject loansAPI Definition
  const injections = `
export const loansAPI = {
  getLoans: () => apiClient.get('/loans'),
  getLoanById: (id: string) => apiClient.get(\`/loans/\${id}\`),
  createLoan: (data: any) => apiClient.post('/loans', data),
  addPayment: (id: string, data: any) => apiClient.post(\`/loans/\${id}/payment\`, data),
  addCharge: (id: string, data: any) => apiClient.post(\`/loans/\${id}/charge\`, data),
};
`;

  apiText = apiText.replace('export const settingsAPI', injections + '\\nexport const settingsAPI');
  
  // Expose it in default object
  apiText = apiText.replace('  cfo: cfoAPI,', '  cfo: cfoAPI,\\n  loans: loansAPI,');
  
  fs.writeFileSync('src/lib/api.ts', apiText);
  console.log('Added loansAPI to api.ts');
} else {
  console.log('Already exists');
}
