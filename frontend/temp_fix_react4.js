const fs = require('fs');

let f = fs.readFileSync('src/app/loans/page.tsx', 'utf8');
f = f.replace("      const response = await api.loans.getLoans(projectId as string);\r\n        headers: projectId ? { 'x-project-id': projectId } : {},\r\n      });", "      const response = await api.loans.getLoans(projectId as string);");
f = f.replace("      const response = await api.loans.getLoans(projectId as string);\n        headers: projectId ? { 'x-project-id': projectId } : {},\n      });", "      const response = await api.loans.getLoans(projectId as string);");
fs.writeFileSync('src/app/loans/page.tsx', f);

let f2 = fs.readFileSync('src/lib/api.ts', 'utf8');
f2 = f2.replace("\\nexport const settingsAPI", "\nexport const settingsAPI");
f2 = f2.replace("\\n  loans:", "\n  loans:");
fs.writeFileSync('src/lib/api.ts', f2);
