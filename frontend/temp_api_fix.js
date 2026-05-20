const fs = require('fs');

let apiText = fs.readFileSync('src/lib/api.ts', 'utf8');

// Update loansAPI to accept arguments
apiText = apiText.replace(
  /export const loansAPI = {[\s\S]*?};/,
  `export const loansAPI = {
  getLoans: (projectId: string) => apiClient.get('/loans?projectId=' + projectId),
  getLoanById: (id: string) => apiClient.get(\`/loans/\${id}\`),
  createLoan: (data: any) => apiClient.post('/loans', data),
  addPayment: (id: string, data: any) => apiClient.post(\`/loans/\${id}/payment\`, data),
  addCharge: (id: string, data: any) => apiClient.post(\`/loans/\${id}/charge\`, data),
};`
);

fs.writeFileSync('src/lib/api.ts', apiText);
console.log('Fixed api.ts loansAPI arguments');
