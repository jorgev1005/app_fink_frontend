const fs = require('fs');

// Fix api.ts newline literal issue
let apiText = fs.readFileSync('src/lib/api.ts', 'utf8');
apiText = apiText.replace(/\\nexport const settingsAPI/, '\nexport const settingsAPI');
apiText = apiText.replace(/\\n  loans: loansAPI,/, '\n  loans: loansAPI,');
fs.writeFileSync('src/lib/api.ts', apiText);

// Fix loans/page.tsx syntax issue
let pageText = fs.readFileSync('src/app/loans/page.tsx', 'utf8');
// remove the lingering curly brace and headers stuff
pageText = pageText.replace(/        headers: projectId \? \{ 'x-project-id': projectId \} : \{\},\s*\/\/ \}\);/g, ''); // Wait, I'll just use a safer replace

pageText = pageText.replace("        headers: projectId ? { 'x-project-id': projectId } : {},\\n      });", "");
const fixedPage = pageText.split('\\n').filter(l => !l.includes("headers: projectId ?") && !l.includes("});") || l.includes('return')).join('\\n');
// Let's do string overwrite completely for loadLoans to be safe

pageText = pageText.replace(/const loadLoans = async \(\) => \{[\s\S]*?\} catch \(err: any\) \{/m, 
\`const loadLoans = async () => {
    try {
      setLoading(true);
      const projectId = localStorage.getItem('selectedProjectId');
      const response = await api.loans.getLoans(projectId as string);
      setLoans(response.data);
    } catch (err: any) {\`);

fs.writeFileSync('src/app/loans/page.tsx', pageText);
console.log('Fixed react syntax issues');
