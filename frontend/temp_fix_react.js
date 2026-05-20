const fs = require('fs');

let page = fs.readFileSync('src/app/loans/page.tsx', 'utf8');
page = page.replace(/\\\\/g, '\\\\'); // Just to be safe, though not what we need
page = page.replace(/\\\`/g, '\`');
page = page.replace(/\\\$/g, '\$');
fs.writeFileSync('src/app/loans/page.tsx', page);

let idPage = fs.readFileSync('src/app/loans/[id]/page.tsx', 'utf8');
idPage = idPage.replace(/\\\`/g, '\`');
idPage = idPage.replace(/\\\$/g, '\$');
fs.writeFileSync('src/app/loans/[id]/page.tsx', idPage);

console.log('Fixed backticks strings');
